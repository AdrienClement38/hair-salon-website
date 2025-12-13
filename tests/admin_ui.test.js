const puppeteer = require('puppeteer');
const path = require('path');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = { username: 'test_runner', password: 'password123', displayName: 'Test Runner' };
const WORKER = { username: 'ui_test_worker', password: 'password123', displayName: 'Automated Worker' };

// Native fetch Node 18+
const fetch = global.fetch;

describe('Admin UI & Profile Switching', () => {
    let browser;
    let page;
    let workerId;

    jest.setTimeout(60000);

    beforeAll(async () => {
        // --- DB SETUP ---
        await db.initPromise;
        const hash = await bcrypt.hash(TEST_USER.password, 10);

        try {
            await db.createAdmin(TEST_USER.username, hash, TEST_USER.displayName);
        } catch (e) {
            // Ignore constraint violation (user exists)
        }

        // --- WORKER SETUP ---
        const auth = Buffer.from(`${TEST_USER.username}:${TEST_USER.password}`).toString('base64');
        const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };

        const listRes = await fetch(`${BASE_URL}/api/admin/workers`, { headers });
        if (!listRes.ok) throw new Error("API Auth with injected user failed");

        const workers = await listRes.json();
        const existing = workers.find(w => w.username === WORKER.username);
        if (existing) {
            workerId = existing.id;
        } else {
            const createRes = await fetch(`${BASE_URL}/api/admin/workers`, {
                method: 'POST',
                headers,
                body: JSON.stringify(WORKER)
            });
            if (createRes.ok) {
                const newWorkers = await (await fetch(`${BASE_URL}/api/admin/workers`, { headers })).json();
                workerId = newWorkers.find(w => w.username === WORKER.username).id;
            } else {
                throw new Error("Failed to create worker");
            }
        }
    });

    beforeEach(async () => {
        browser = await puppeteer.launch({ headless: 'new' });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
    });

    afterEach(async () => {
        await browser.close();
    });

    test('Should update dashboard title and settings headers when switching profiles', async () => {
        await page.goto(`${BASE_URL}/admin.html`);

        // Login
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');

        // Wait for dashboard
        await page.waitForSelector('#dashboard-view', { visible: true });

        // Wait for Loading to Complete (Title Update)
        // Title should eventually contain "Salon" (default filter)
        await page.waitForFunction(() => {
            const h1 = document.querySelector('header h1');
            return h1 && h1.textContent.includes('Tableau de Bord - Salon');
        }, { timeout: 10000 });

        // 1. Verify Initial State (Salon)
        const title1 = await page.$eval('header h1', el => el.textContent);
        expect(title1).toContain('Salon');

        // Go to Settings
        await page.click('#tab-btn-settings');
        await page.waitForSelector('#tab-settings', { visible: true });

        const profileHeader1 = await page.$eval('#profile-form', el => el.closest('.settings-section').querySelector('h3').textContent);
        expect(profileHeader1).toBe('Mon Profil');

        // 2. Switch to Worker
        if (!workerId) throw new Error("Worker ID missing");
        await page.select('#admin-filter', String(workerId));

        // Wait for Title Update
        await page.waitForFunction((name) => {
            const h1 = document.querySelector('header h1');
            return h1 && h1.textContent.includes(name);
        }, { timeout: 5000 }, WORKER.displayName);

        // Verify Headers
        const title2 = await page.$eval('header h1', el => el.textContent);
        expect(title2).toContain(WORKER.displayName);

        const holidaysHeader2 = await page.$eval('#leaves-section-title', el => el.textContent);
        expect(holidaysHeader2).toContain(WORKER.displayName);

        const profileHeader2 = await page.$eval('#profile-form', el => el.closest('.settings-section').querySelector('h3').textContent);
        expect(profileHeader2).toContain(WORKER.displayName);

        // 3. Switch Back to Salon
        await page.select('#admin-filter', '');

        // Wait for Title Revert
        await page.waitForFunction(() => {
            const h1 = document.querySelector('header h1');
            return h1 && h1.textContent.includes('Salon');
        }, { timeout: 5000 });

        const title3 = await page.$eval('header h1', el => el.textContent);
        expect(title3).toContain('Salon');

        const profileHeader3 = await page.$eval('#profile-form', el => el.closest('.settings-section').querySelector('h3').textContent);
        expect(profileHeader3).toBe('Mon Profil');

    }, 60000);
});
