const puppeteer = require('puppeteer');
const path = require('path');
const bcrypt = require('bcryptjs');

const http = require('http');
const app = require('../server/app'); // Import app
const { initPromise } = require('../server/models/database'); // Ensure DB init

let server;
let BASE_URL;

// Native fetch Node 18+
const fetch = global.fetch;

describe('Admin UI & Profile Switching', () => {
    let browser;
    let page;
    let workerId;

    const TEST_USER = { username: 'test_runner_' + Date.now(), password: 'password123', displayName: 'Test Runner' };
    const WORKER = { username: 'ui_test_worker_' + Date.now(), password: 'password123', displayName: 'Automated Worker' };

    jest.setTimeout(120000);

    // Helper to get auth header
    const getAuth = (u, p) => ({ 'Authorization': `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`, 'Content-Type': 'application/json' });

    beforeAll(async () => {
        // Start Isolated Server
        await initPromise; // Wait for DB to be ready (InMemory due to NODE_ENV=test)

        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        BASE_URL = `http://localhost:${port}`;


        // 1. Setup Data - Since DB is fresh/in-memory, we start from scratch.
        // Create first admin (Setup)
        const setupRes = await fetch(`${BASE_URL}/api/auth/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });

        if (!setupRes.ok) {
            throw new Error(`Failed to setup test runner: ${await setupRes.text()}`);
        }

        // 2. Login and Create Worker
        const auth = getAuth(TEST_USER.username, TEST_USER.password);

        const createWorkerRes = await fetch(`${BASE_URL}/api/admin/workers`, {
            method: 'POST',
            headers: auth,
            body: JSON.stringify(WORKER)
        });

        if (createWorkerRes.ok) {
            const allRes = await fetch(`${BASE_URL}/api/admin/workers`, { headers: auth });
            const all = await allRes.json();
            const w = all.find(u => u.username === WORKER.username);
            if (w) {
                workerId = w.id;
            }
        } else {
            throw new Error("Failed to create worker for test");
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
        // Cleanup via API using default admin (assuming it persists)
        const auth = getAuth('admin', 'password');
        // No explicit DB cleanup needed as it is in-memory and process ends/server closes.
        // But we should close the server.
        if (server) server.close();
    });

    test('Should update dashboard title and settings headers when switching profiles', async () => {
        await page.goto(`${BASE_URL}/lbc-admin`);

        // Login (Try TEST_USER first, else admin)
        // If TEST_USER creation failed, this login will fail.
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');

        // Fallback checks? If login fails, URL remains login?
        // Let's assume success or fail test.
        try {
            await page.waitForSelector('#dashboard-view', { visible: true, timeout: 5000 });
        } catch (e) {
            // Retry with admin/password
            await page.reload();
            await page.type('#username', 'admin');
            await page.type('#password', 'password');
            await page.click('#login-form button[type="submit"]');
            await page.waitForSelector('#dashboard-view', { visible: true });
        }

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
        await page.waitForSelector('#tab-settings', { visible: true, timeout: 60000 });

        const profileHeader1 = await page.$eval('#profile-form', el => el.closest('.settings-section').querySelector('h3').textContent);
        expect(profileHeader1).toBe('Profil du Salon');

        const profileInputVal1 = await page.$eval('#profile-displayname', el => el.value);
        expect(profileInputVal1).toBe('Salon');

        // 2. Switch to Worker
        if (!workerId) {
            console.warn("Skipping worker switch test part because workerId is missing");
            return;
        }

        // --- Add Personal Leave for Today ---
        const today = new Date().toISOString().split('T')[0];
        // Use proper auth
        await fetch(`${BASE_URL}/api/admin/leaves`, {
            method: 'POST',
            headers: getAuth('admin', 'password'), // use admin
            body: JSON.stringify({ start: today, end: today, adminId: workerId, note: 'Test Leave' })
        });

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
        expect(profileHeader3).toBe('Profil du Salon');

        const profileInputVal3 = await page.$eval('#profile-displayname', el => el.value);
        expect(profileInputVal3).toBe('Salon');

    }, 70000);

    test('Should ensure Team Management form is empty on load', async () => {
        // Navigate to Admin
        await page.goto(`${BASE_URL}/lbc-admin`);

        // Login
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');
        await page.waitForSelector('#dashboard-view', { visible: true });

        // Go to Settings tab
        await page.click('#tab-btn-settings');
        await page.waitForSelector('#tab-settings', { visible: true });
        await page.waitForSelector('#team-form', { visible: true });

        // Check fields are empty
        const usernameVal = await page.$eval('#team-username', el => el.value);
        const displayVal = await page.$eval('#team-displayname', el => el.value);
        const passVal = await page.$eval('#team-password', el => el.value);

        expect(usernameVal).toBe('');
        expect(displayVal).toBe('');
        expect(passVal).toBe('');
    });

    test('Should sync profile name updates across UI components', async () => {
        // 1. Setup - Go to Admin
        await page.goto(`${BASE_URL}/lbc-admin`);
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');
        await page.waitForSelector('#dashboard-view', { visible: true });

        // 2. Select Worker
        await page.select('#admin-filter', String(workerId));

        // Go to Settings
        await page.click('#tab-btn-settings');
        await page.waitForSelector('#tab-settings', { visible: true });

        // Verify initial state
        const initialProfileHeader = await page.$eval('#profile-form', el => el.closest('.settings-section').querySelector('h3').textContent);
        expect(initialProfileHeader).toContain(WORKER.displayName);

        // 3. Rename Worker
        const NEW_NAME = "Renamed Worker " + Date.now();
        await page.evaluate((val) => {
            document.getElementById('profile-displayname').value = val;
        }, NEW_NAME);

        // Submit
        // We need to handle the alert that pops up
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        await page.click('#profile-form button[type="submit"]');

        // 4. Wait for Polling Cycle (approx 5s)
        // We wait slightly longer to ensure the poll triggers and UI updates
        await new Promise(r => setTimeout(r, 6000));

        // 5. Verify UI Updates without page reload

        // A. Verify Filter Dropdown Text
        const dropdownText = await page.$eval('#admin-filter', el => el.options[el.selectedIndex].text);
        expect(dropdownText).toBe(NEW_NAME);

        // B. Verify "Profil de ..." Header
        const updatedProfileHeader = await page.$eval('#profile-form', el => el.closest('.settings-section').querySelector('h3').textContent);
        expect(updatedProfileHeader).toContain(NEW_NAME);

        // C. Verify "Période de congés de ..." Header
        const holidaysHeader = await page.$eval('#leaves-section-title', el => el.textContent);
        expect(holidaysHeader).toContain(NEW_NAME);

        // D. Verify Dashboard Header Title
        // Need to check if header is visible or if we need to look at the DOM
        const dashboardTitle = await page.$eval('header h1', el => el.textContent);
        expect(dashboardTitle).toContain(NEW_NAME);

    }, 30000); // 30s timeout

    test('Should display "Notre Travail" section in content tab', async () => {
        await page.goto(`${BASE_URL}/lbc-admin`);

        // Login
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');
        await page.waitForSelector('#dashboard-view', { visible: true });

        // Go to Content tab
        await page.waitForSelector('#tab-btn-content', { visible: true });
        await new Promise(r => setTimeout(r, 500)); // Small yield
        await page.click('#tab-btn-content');

        try {
            await page.waitForSelector('#tab-content', { visible: true, timeout: 5000 });
        } catch (e) {
            // Retry clicking content tab...
            await page.click('#tab-btn-content');
            await page.waitForSelector('#tab-content', { visible: true, timeout: 5000 });
        }

        // Check for Portfolio header
        // Since sections are multiple, we check text content
        const portfolioHeader = await page.$eval('#tab-content', el => {
            const h3s = Array.from(el.querySelectorAll('h3'));
            return h3s.some(h => h.textContent.includes('Notre Travail'));
        });
        expect(portfolioHeader).toBe(true);

        // Check for Add button
        const addBtn = await page.$eval('#tab-content', el => {
            return !!el.querySelector('button[onclick="addPortfolioItem()"]');
        });
        expect(addBtn).toBe(true);
    });
});
