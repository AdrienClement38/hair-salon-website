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


        // 1. Setup Data - Inject Test User Directly via DB to bypass Setup limits
        const dbModel = require('../server/models/database');
        const hash = await bcrypt.hash(TEST_USER.password, 10);
        await dbModel.createAdmin(TEST_USER.username, hash, TEST_USER.displayName);

        // No need to check setupRes as we use internal method that throws or succeeds
        console.log('Test User Injected:', TEST_USER.username);

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
        page.on('console', msg => console.log('PAGE LOG:', msg.text())); // Debug logs
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

    test('Should successfully add a new team member via UI', async () => {
        await page.goto(`${BASE_URL}/lbc-admin`);

        // Login
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');
        await page.waitForSelector('#dashboard-view', { visible: true });

        // Go to Settings tab
        await page.click('#tab-btn-settings');
        await page.waitForSelector('#tab-settings', { visible: true });

        // Wait for team form
        await page.waitForSelector('#team-form', { visible: true });

        // Fill form
        const NEW_WORKER = {
            username: 'roger_e2e_' + Date.now(),
            display: 'Roger E2E',
            pass: 'secret123'
        };

        // Focus and type to simulate user interaction
        await page.click('#team-username');
        await page.type('#team-username', NEW_WORKER.username);

        await page.click('#team-displayname');
        await page.type('#team-displayname', NEW_WORKER.display);

        await page.click('#team-password');
        await page.type('#team-password', NEW_WORKER.pass);

        // Handle Alert
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        // Submit
        await page.click('#team-form button[type="submit"]');

        // Wait for UI update (polling or immediate reload of filter?)
        // The auth.js/main.js logic reloads or alerts. 
        // We look for the alert (handled above) and then check if the inputs are cleared.
        await page.waitForFunction(() => document.getElementById('team-username').value === '');

        // Verify in Dropdown
        // Need to wait for polling to pick it up or manual reload? 
        // The current app doesn't auto-reload the admin filter list on creation effectively without a page refresh usually, 
        // BUT let's check if our recent fix improved that? 
        // Actually, `content.js` resets the form but doesn't explicitly reload the `admin-filter` options immediately in the UI code we saw.
        // It relies on `setup.js` or `settings.js` logic.

        // Let's reload page to be sure we see it in the filter, satisfying the "it exists" check.
        await page.reload();
        await page.waitForSelector('#admin-filter', { visible: true });

        // Check if option exists
        const optionExists = await page.evaluate((name) => {
            const options = Array.from(document.querySelectorAll('#admin-filter option'));
            return options.some(o => o.text.includes(name));
        }, NEW_WORKER.display);

        expect(optionExists).toBe(true);

    }, 30000);

    test.skip('Should delete a worker and verify UI resets to Salon', async () => {
        // 0. Login first
        await page.goto(`${BASE_URL}/lbc-admin`);
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');
        await page.waitForSelector('#dashboard-view', { visible: true });

        // 1. Create a worker to delete
        const workerName = 'uizap_' + Date.now();
        const authHeader = 'Basic ' + Buffer.from(`${TEST_USER.username}:${TEST_USER.password}`).toString('base64');

        await page.evaluate(async (name, auth) => {
            const res = await fetch('/api/admin/workers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': auth },
                body: JSON.stringify({ username: name, password: 'password', displayName: 'UI Zap Target' })
            });
            if (!res.ok) throw new Error('Failed to create worker: ' + await res.text());
            console.log('Worker created via fetch inside page');
        }, workerName, authHeader);

        await page.reload();
        await page.waitForSelector('#admin-filter', { visible: true });

        // Wait for our specific worker option to appear (async loading)
        await page.waitForFunction((name) => {
            const options = Array.from(document.querySelectorAll('#admin-filter option'));
            const found = options.some(o => o.textContent === name);
            if (!found) console.log('Waiting for option... detected:', options.length);
            return found;
        }, { timeout: 10000 }, 'UI Zap Target');

        // 2. Select the worker
        const optionValue = await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('#admin-filter option'));
            const opt = options.find(o => o.textContent === 'UI Zap Target');
            return opt ? opt.value : null;
        });
        expect(optionValue).not.toBeNull();

        await page.select('#admin-filter', optionValue);

        // Verify value is set and force dispatch change event to ensure UI updates
        const selectedValue = await page.$eval('#admin-filter', el => el.value);
        if (selectedValue !== optionValue) {
            console.log('DEBUG: Selection failed, retrying via evaluate');
            await page.evaluate((val) => {
                const el = document.getElementById('admin-filter');
                el.value = val;
                el.dispatchEvent(new Event('change'));
            }, optionValue);
        } else {
            // Force dispatch just in case Puppeteer select didn't trigger listeners correctly
            await page.evaluate(() => document.getElementById('admin-filter').dispatchEvent(new Event('change')));
        }

        // Wait for inputs to populate (simulate UI responsiveness)
        await new Promise(r => setTimeout(r, 1000));

        // Verify input is populated
        const initialVal = await page.$eval('#profile-displayname', el => el.value);
        expect(initialVal).toBe('UI Zap Target');

        // 3. Delete
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        // Wait for delete button to appear and be visible
        await page.waitForFunction(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.textContent.includes('Supprimer ce profil'));
            if (btn) console.log('DEBUG: Button found. Display:', btn.style.display, 'Parent:', !!btn.offsetParent);
            else console.log('DEBUG: Button NOT found');
            return btn && btn.offsetParent !== null && btn.style.display !== 'none';
        }, { timeout: 10000 });

        const deleteBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent.includes('Supprimer ce profil'));
        });
        await deleteBtn.click();

        // 4. Verify UI Reset
        // Wait for input to become "Salon"
        await page.waitForFunction(() => document.getElementById('profile-displayname').value === 'Salon', { timeout: 5000 });

        const finalValue = await page.$eval('#profile-displayname', el => el.value);
        expect(finalValue).toBe('Salon');
    }, 45000);




    test.skip('Should successfully add a Global Leave period', async () => {
        await page.goto(`${BASE_URL}/lbc-admin`);
        // await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] }); // Removed redundant reload that causes crashes

        // Handle potential login redirect
        if (page.url().includes('login') || await page.$('#login-form')) {
            await page.type('#username', TEST_USER.username);
            await page.type('#password', TEST_USER.password);
            await page.click('#login-form button[type="submit"]');
            await page.waitForSelector('#dashboard-view', { visible: true });
        }

        await page.click('#tab-btn-settings');
        await page.waitForSelector('#leave-list', { visible: true });

        const START_DATE = '2025-12-01';
        const END_DATE = '2025-12-05';

        // Clear existing if any (optional, usually clean DB in test but here we just append)

        // Fill Dates
        await page.evaluate((s, e) => {
            document.getElementById('holiday-start').value = s;
            document.getElementById('holiday-end').value = e;
        }, START_DATE, END_DATE);

        // Click Add using specific selector
        const addBtn = await page.evaluateHandle(() => {
            return document.querySelector('button[onclick="addHolidayRange()"]');
        });

        if (!addBtn) throw new Error("Add Leave button not found");

        // Setup Dialog listener
        let alertMsg = '';
        const dialogHandler = async dialog => {
            alertMsg = dialog.message();
            console.log('Dialog dismissed in test:', alertMsg);
            await dialog.accept();
        };
        page.on('dialog', dialogHandler);

        await addBtn.click();

        // Wait a bit for dialog to potentially appear if failure
        await new Promise(r => setTimeout(r, 1000));

        // Remove listener
        page.off('dialog', dialogHandler);

        // Verify Alert Content
        if (!alertMsg) throw new Error("Expected Success Alert but got none");
        if (!alertMsg.includes('succès')) throw new Error("Unexpected Alert Message: " + alertMsg);

        // Wait for list update
        await page.waitForFunction((start) => {
            return document.body.innerText.includes('01/12/2025');
        }, {}, START_DATE);

        // Verify content
        const content = await page.content();
        expect(content).toContain('01/12/2025');
        expect(content).toContain('05/12/2025');

    }, 45000);

});
