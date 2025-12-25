const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/app');
const { initPromise, createPortfolioItem, createAdmin } = require('../server/models/database');

let server;
let BASE_URL;

describe('Portfolio UX', () => {
    let browser;
    let page;

    beforeAll(async () => {
        // Init DB
        await initPromise;

        // Start Server
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        BASE_URL = `http://localhost:${port}`;

        // Seed Data for Portfolio Test on Clone DB
        const testAdminUser = 'portfolio_' + Date.now();
        const hash = await require('bcryptjs').hash('password', 10);
        // createAdmin returns { lastInsertRowid: id } with sql.js or pg logic
        const adminRes = await createAdmin(testAdminUser, hash, 'Portfolio Admin');
        const adminId = adminRes.lastInsertRowid || adminRes.id || 1; // Fallback if necessary

        // Seed Portfolio Items
        await createPortfolioItem('test_image_1.jpg', 'Test Description 1', adminId);
        await createPortfolioItem('test_image_2.jpg', 'Test Description 2', adminId);
    });

    afterAll(async () => {
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

    test('Portfolio: Should load items and respect limit', async () => {
        // Navigate to Home
        await page.goto(BASE_URL);
        await page.setViewport({ width: 1280, height: 800 });

        // Click "Notre Travail" to trigger load (or scroll to it? logic depends on implementation)
        // The original test clicked a link.
        const portfolioLink = await page.$('a[href="#"][onclick*="showPortfolio"]');
        if (portfolioLink) {
            await portfolioLink.click();
        } else {
            // Alternatively, maybe it's just on the page or navigated to?
            // The original test had: await page.click('a[href="#"][onclick*="showPortfolio"]');
            // Check if such link exists, if failing, maybe explicit goto /#portfolio?
            // Assuming original test logic was correct about the click.
            // If the link is not found, maybe invalid selector?
            // The user's main.js might have changed? 
            // Let's assume the selector is correct for now.
            await page.click('a[href="#"][onclick*="showPortfolio"]');
        }

        // Wait for the grid to be populated
        try {
            await page.waitForSelector('#public-portfolio-grid .masonry-item', { timeout: 5000 });
        } catch (e) {
            console.warn("Items did not load in time. Content:", await page.content());
        }

        // Count ALL items
        const totalCount = await page.$$eval('#public-portfolio-grid .masonry-item', items => items.length);

        console.log("Portfolio Items Found:", totalCount);

        // Expect items to be loaded
        expect(totalCount).toBeGreaterThan(0);
        expect(totalCount).toBeLessThanOrEqual(50);

    }, 30000);
});
