const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/app');
const { initPromise, createAdmin } = require('../server/models/database');
const bcrypt = require('bcryptjs');
const fs = require('fs');

function log(msg) {
    try {
        fs.appendFileSync('test_debug.log', msg + '\n');
    } catch (e) { }
}

let server;
let BASE_URL;

describe('Admin Profile UI Logic', () => {
    let browser;
    let page;
    let workerId;
    const workerName = 'Test Worker';
    const workerUser = 'worker_vis_test';

    beforeAll(async () => {
        // Init DB
        await initPromise;

        // Start Server
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        BASE_URL = `http://localhost:${port}`;

        // Create Main Admin
        const hash = await bcrypt.hash('password', 10);
        await createAdmin('admin_vis', hash, 'Admin Vis');

        // Create Worker
        const wRes = await createAdmin(workerUser, hash, workerName);
        workerId = wRes.lastInsertRowid || wRes.id;

        if (fs.existsSync('test_debug.log')) fs.unlinkSync('test_debug.log');
        log(`Worker Created ID: ${workerId}`);
    });

    afterAll(() => {
        if (server) server.close();
    });

    beforeEach(async () => {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    test('Profile section visibility and auto-fill behavior', async () => {
        log('Test Start');

        try {
            // 1. Login
            await page.goto(`${BASE_URL}/admin.html`); // Direct to admin, should redirect to login

            // Bypass UI Login (Flaky frame detached error)
            // Inject valid auth token directly
            const authString = Buffer.from('admin_vis:password').toString('base64');
            await page.evaluate((token) => {
                localStorage.setItem('auth', token);
            }, authString);

            log('Auth token injected. Reloading via goto...');
            await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'domcontentloaded' });

            // Check if login view is gone, dashboard is visible
            // If verifyAuth fails, it will clear auth and show login, so this assertion also verifies auth check.
            log('Reload complete.');

            log('Waiting for admin-filter...');
            // 2. Wait for Dashboard and Workers Load
            await page.waitForSelector('#admin-filter');

            log('Waiting for worker option ' + workerId);
            // Wait for our worker to appear in the dropdown (async fetch)
            try {
                // Wait a bit longer and check body if fail
                await page.waitForSelector(`#admin-filter option[value="${workerId}"]`, { timeout: 10000 });
                log('Worker option found.');
            } catch (e) {
                log('Timeout waiting for worker option. Dumping body HTML...');
                const html = await page.$eval('body', e => e.innerHTML);
                log('--- HTML START ---');
                log(html.substring(0, 500));
                log('--- HTML END ---');
                throw e;
            }

            // 3. Select "Salon" (empty value)
            log('Selecting Salon...');
            await page.select('#admin-filter', '');

            // ASSERT: Profile Section should be hidden
            // User asked "tests sur les requetes" -> We query the computed style property
            let display = await page.$eval('#profile-section', el => getComputedStyle(el).display);
            let daysOffDisplay = await page.$eval('#weekly-days-off-wrapper', el => getComputedStyle(el).display);
            let vacationsDisplay = await page.$eval('#vacations-wrapper', el => getComputedStyle(el).display);

            log('Display for Salon: ' + display);
            expect(display).toBe('none');
            expect(daysOffDisplay).toBe('none');
            // Update: Vacations wrapper SHOULD be visible for Salon now
            expect(vacationsDisplay).not.toBe('none');

            // ASSERT: Title should indicate "Fermetures du Salon"
            let leavesName = await page.$eval('#leaves-worker-name', el => el.textContent);
            expect(leavesName).toContain('Fermetures du Salon');

            // 4. Select Worker
            log('Selecting Worker...');
            await page.select('#admin-filter', workerId.toString());

            // ASSERT: Profile Section should be visible
            display = await page.$eval('#profile-section', el => getComputedStyle(el).display);
            daysOffDisplay = await page.$eval('#weekly-days-off-wrapper', el => getComputedStyle(el).display);
            vacationsDisplay = await page.$eval('#vacations-wrapper', el => getComputedStyle(el).display);

            log('Display for Worker: ' + display);
            expect(display).not.toBe('none');
            expect(daysOffDisplay).not.toBe('none');
            expect(vacationsDisplay).not.toBe('none');

            // ASSERT: Inputs are auto-filled
            const uVal = await page.$eval('#profile-username', el => el.value);
            const dVal = await page.$eval('#profile-displayname', el => el.value);
            log(`Values: ${uVal}, ${dVal}`);

            expect(uVal).toBe(workerUser);
            expect(dVal).toBe(workerName);

            // ASSERT: Days Off Name Check
            // Old Check: const daysOffName = await page.$eval('#weekly-off-worker-name', el => el.textContent);
            // New Check: Main title contains name
            leavesName = await page.$eval('#leaves-worker-name', el => el.textContent);
            expect(leavesName).toContain(workerName);

            // ASSERT: Vacations Name Check
            // Redundant now, covered by leavesName check above.
            // const vacationsName = await page.$eval('#vacations-worker-name', el => el.textContent);
            // expect(vacationsName).toContain(workerName);

            // 5. Switch back to Salon
            log('Switching back to Salon...');
            await page.select('#admin-filter', '');

            // ASSERT: Hidden again (Except Vacations)
            display = await page.$eval('#profile-section', el => getComputedStyle(el).display);
            daysOffDisplay = await page.$eval('#weekly-days-off-wrapper', el => getComputedStyle(el).display);
            vacationsDisplay = await page.$eval('#vacations-wrapper', el => getComputedStyle(el).display);

            expect(display).toBe('none');
            expect(daysOffDisplay).toBe('none');
            expect(vacationsDisplay).not.toBe('none');
            leavesName = await page.$eval('#leaves-worker-name', el => el.textContent);
            expect(leavesName).toContain('Fermetures du Salon');

            log('Test Finished Successfully');

        } catch (err) {
            log('TEST FAILED: ' + err.message);
            throw err;
        }

    }, 30000); // 30s timeout
});
