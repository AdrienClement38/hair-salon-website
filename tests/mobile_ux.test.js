const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/app');
const { initPromise, setSetting } = require('../server/models/database');

let server;
let BASE_URL;

describe('Mobile UX Tests (375x667)', () => {
    let browser;
    let page;

    beforeAll(async () => {
        await initPromise;
        // SEED DATA: Services for Public Test
        await setSetting('services', [
            { name: 'Service 1', price: 10, icon: 'cut', description: 'Test Desc' },
            { name: 'Service 2', price: 20, icon: 'razor', description: 'Test Desc 2' },
            { name: 'Service 3', price: 30, icon: 'barber', description: 'Test Desc 3' }
        ]);

        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        BASE_URL = `http://localhost:${port}`;
    });

    afterAll(async () => {
        if (server) server.close();
    });

    beforeEach(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        // Emulate iPhone SE
        await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    test('Public: Services Grid should stack vertically on mobile', async () => {
        try {
            await page.goto(BASE_URL);
            await page.waitForSelector('#services-grid .card', { timeout: 5000 });

            const positions = await page.evaluate(() => {
                const cards = document.querySelectorAll('#services-grid .card');
                if (cards.length < 2) return null;
                const r1 = cards[0].getBoundingClientRect();
                const r2 = cards[1].getBoundingClientRect();
                return {
                    card1: { x: r1.x, y: r1.y, width: r1.width },
                    card2: { x: r2.x, y: r2.y }
                };
            });

            if (positions) {
                // Stacked: Card 2 below Card 1
                expect(positions.card2.y).toBeGreaterThan(positions.card1.y + 50);
                // Full width: Card 1 should be > 300px (viewport 375)
                expect(positions.card1.width).toBeGreaterThan(300);
            } else {
                throw new Error("Less than 2 cards found");
            }
        } catch (e) {
            console.error("Public Test Failed:", e);
            await page.screenshot({ path: 'mobile_fail_public.png' });
            throw e;
        }
    });

    test.skip('Admin: Dashboard Tabs should be accessible/visible', async () => {
        try {
            await page.goto(`${BASE_URL}/lbc-admin`);

            await page.waitForFunction(() =>
                (document.getElementById('setup-view') && document.getElementById('setup-view').style.display !== 'none') ||
                (document.getElementById('login-view') && document.getElementById('login-view').style.display !== 'none') ||
                (document.getElementById('dashboard-view') && document.getElementById('dashboard-view').style.display !== 'none')
                , { timeout: 5000 });

            // Check if already in Dashboard (cookies persisted?)
            if (await page.$eval('#dashboard-view', el => el.style.display !== 'none')) {
                // Already logged in
            } else {
                const needsSetup = await page.$eval('#setup-view', el => el.style.display !== 'none');

                if (needsSetup) {
                    await page.type('#setup-username', 'mobile_admin');
                    await page.type('#setup-password', 'password');
                    // Setup triggers reload
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'load' }),
                        page.click('#setup-form button')
                    ]);
                } else {
                    if (await page.$eval('#login-view', el => el.style.display !== 'none')) {
                        await page.type('#username', 'mobile_admin'); // Use consistent user
                        await page.type('#password', 'password');
                        await page.click('#login-form button');
                    }
                }
            }

            await page.waitForSelector('#dashboard-view', { visible: true, timeout: 5000 });

            const contentTabBtn = await page.waitForSelector('#tab-btn-content');
            const box = await contentTabBtn.boundingBox();

            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(375);
        } catch (e) {
            console.error("Admin Tabs Test Failed:", e);
            await page.screenshot({ path: 'mobile_fail_admin_tabs.png' });
            throw e;
        }
    });

    test.skip('Admin: Tables should have horizontal scroll container', async () => {
        try {
            await page.goto(`${BASE_URL}/lbc-admin`);

            await page.waitForFunction(() =>
                (document.getElementById('dashboard-view') && document.getElementById('dashboard-view').style.display !== 'none') ||
                (document.getElementById('login-view') && document.getElementById('login-view').style.display !== 'none') ||
                (document.getElementById('setup-view') && document.getElementById('setup-view').style.display !== 'none')
            );

            const isDashboard = await page.$eval('#dashboard-view', el => el.style.display !== 'none');
            if (!isDashboard) {
                const needsSetup = await page.$eval('#setup-view', el => el.style.display !== 'none');
                if (needsSetup) {
                    await page.type('#setup-username', 'mobile_admin');
                    await page.type('#setup-password', 'password');
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'load' }),
                        page.click('#setup-form button')
                    ]);
                } else {
                    await page.type('#username', 'mobile_admin'); // Consistent user
                    await page.type('#password', 'password');
                    await page.click('#login-form button');
                }
                await page.waitForSelector('#dashboard-view', { visible: true });
            }

            await page.click('#tab-btn-settings');
            await page.waitForSelector('#schedule-table', { visible: true, timeout: 5000 });

            const overflow = await page.$eval('#schedule-table', table => {
                const style = window.getComputedStyle(table);
                if (style.overflowX === 'auto' || style.overflowX === 'scroll') return style.overflowX;
                return window.getComputedStyle(table.parentElement).overflowX;
            });

            expect(['auto', 'scroll']).toContain(overflow);
        } catch (e) {
            console.error("Admin Table Test Failed:", e);
            await page.screenshot({ path: 'mobile_fail_admin_table.png' });
            throw e;
        }
    });

});
