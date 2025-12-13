const puppeteer = require('puppeteer');
const path = require('path');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:3000';
// Use existing Manager for robust auth
const MANAGER = { username: 'manager', password: 'password123' };
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

        // Setup Worker using Manager Auth from API
        // We assume 'manager' exists. If not, this test will fail on Auth, but manager should exist.

        const auth = Buffer.from(`${MANAGER.username}:${MANAGER.password}`).toString('base64');
        const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };

        // Verify Manager Auth works
        const listRes = await fetch(`${BASE_URL}/api/admin/workers`, { headers });
        if (!listRes.ok) {
            const txt = await listRes.text();
            throw new Error(`API Auth with MANAGER failed: ${listRes.status} ${txt}`);
        }

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
                // Fetch again to get ID
                const newWorkers = await (await fetch(`${BASE_URL}/api/admin/workers`, { headers })).json();
                workerId = newWorkers.find(w => w.username === WORKER.username).id;
            } else {
                const txt = await createRes.text();
                throw new Error(`Failed to create worker: ${txt}`);
            }
        }
    });

    beforeEach(async () => {
        browser = await puppeteer.launch({ headless: 'new' });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    afterAll(async () => {
        // Cleanup Test Users
        try {
            if (db.deleteAdmin) {
                await db.deleteAdmin(WORKER.username); // Only delete the temporary worker
                console.log("Cleanup: Deleted test worker");
            } else {
                console.warn("Cleanup: deleteAdmin not available in db model");
            }
        } catch (e) {
            console.error("Cleanup failed", e);
        }
    });

    test('Should update dashboard title and settings headers when switching profiles', async () => {
        await page.goto(`${BASE_URL}/admin.html`);

        // Login as Manager
        await page.type('#username', MANAGER.username);
        await page.type('#password', MANAGER.password);
        await page.click('#login-form button[type="submit"]');

        // Wait for dashboard
        await page.waitForSelector('#dashboard-view', { visible: true });

        // Wait for Loading to Complete (Title Update)
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

        // --- Add Personal Leave for Today (Authenticated as Manager) ---
        const today = new Date().toISOString().split('T')[0];
        try {
            await fetch(`${BASE_URL}/api/admin/leaves`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${Buffer.from(`${MANAGER.username}:${MANAGER.password}`).toString('base64')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: today, end: today, adminId: workerId, note: 'Test Leave' })
            });
        } catch (e) { console.log("Leave creation error:", e); }

        await page.reload();
        await page.waitForSelector('#dashboard-view', { visible: true });

        // Select Worker
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
