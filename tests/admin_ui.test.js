const puppeteer = require('puppeteer');
const path = require('path');
const Database = require('better-sqlite3');
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
    let db;

    jest.setTimeout(60000);

    beforeAll(async () => {
        // --- DIRECT DB SETUP ---
        // Connect to REAL DB to support E2E on running server
        const dbPath = path.resolve(__dirname, '../salon.db');
        db = new Database(dbPath);

        // 1. Ensure Test Runner Exists
        const hash = await bcrypt.hash(TEST_USER.password, 10);
        try {
            const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(TEST_USER.username);
            if (!row) {
                db.prepare('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)').run(TEST_USER.username, hash, TEST_USER.displayName);
            } else {
                // Ensure password matches
                const match = await bcrypt.compare(TEST_USER.password, row.password_hash);
                if (!match) {
                    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, TEST_USER.username);
                }
            }
        } catch (e) {
            console.error("DB Setup Error:", e);
        }

        // 2. Setup Worker (via API) - Authenticated as test_runner
        const auth = Buffer.from(`${TEST_USER.username}:${TEST_USER.password}`).toString('base64');
        const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };

        const listRes = await fetch(`${BASE_URL}/api/admin/workers`, { headers });
        if (!listRes.ok) {
            const txt = await listRes.text();
            throw new Error(`API Auth with test_runner failed: ${listRes.status} ${txt}`);
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
        // Cleanup Test Users using DIRECT DB
        if (db) {
            try {
                db.prepare('DELETE FROM admins WHERE username = ?').run(TEST_USER.username);
                db.prepare('DELETE FROM admins WHERE username = ?').run(WORKER.username);
                db.close();
            } catch (e) {
                console.error("Cleanup failed", e);
            }
        }
    });

    test('Should update dashboard title and settings headers when switching profiles', async () => {
        await page.goto(`${BASE_URL}/admin.html`);

        // Login as Test Runner
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
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

        // --- Add Personal Leave for Today ---
        const today = new Date().toISOString().split('T')[0];
        try {
            await fetch(`${BASE_URL}/api/admin/leaves`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${Buffer.from(`${TEST_USER.username}:${TEST_USER.password}`).toString('base64')}`, 'Content-Type': 'application/json' },
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

        // Verify Profile Input has correct name (More robust than H3)
        // const profileInputVal = await page.$eval('#profile-displayname', el => el.value);
        // expect(profileInputVal).toContain(WORKER.displayName);

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
