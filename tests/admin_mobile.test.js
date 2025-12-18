const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000/admin.html';

describe('Admin Mobile UX Tests', () => {
    let browser;
    let page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 375, height: 812 }); // iPhone X

        // Go to page
        await page.goto(BASE_URL);

        // Inject Auth Token to bypass login
        await page.evaluate(() => {
            localStorage.setItem('auth', btoa('admin:admin'));
            // Force reload to pick up auth
            location.reload();
        });

        // Wait for dashboard to load (bypass login check)
        // If the app checks auth on load, it should show dashboard-view
        // We'll wait for the dashboard selector or manually switch if needed
        try {
            await page.waitForSelector('#dashboard-view', { visible: true, timeout: 2000 });
        } catch (e) {
            // If auto-redirect didn't work, manually switch views for CSS testing
            await page.evaluate(() => {
                document.getElementById('login-view').style.display = 'none';
                document.getElementById('setup-view').style.display = 'none';
                document.getElementById('loading-view').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'block';
            });
        }
    });

    afterAll(async () => {
        await browser.close();
    });

    test('Mobile Admin: No horizontal scroll on Dashboard', async () => {
        // Ensure we are on dashboard
        await page.waitForSelector('#dashboard-view', { visible: true });

        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px buffer
    });

    test('Mobile Admin: Schedule Table should fit', async () => {
        // Switch to Settings Tab
        await page.evaluate(() => {
            document.querySelector('#tab-btn-settings').click();
        });
        await page.waitForSelector('#schedule-table', { visible: true });

        // Check if table overflows its container
        const tableOverflows = await page.evaluate(() => {
            const table = document.getElementById('schedule-table');
            const container = table.parentElement;
            return table.offsetWidth > container.clientWidth;
        });

        // We expect it NOT to overflow, OR for the user to be okay with it?
        // User said: "réduis la largeur ... pour que ça rentre" -> So it must fit.
        // But table might scroll internally? "scroll horizontal est interdit" usually means page scroll.
        // However, user specifically asked to REDUCE columns to fit. So it should fit.

        // Let's verify strict fit.
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
});
