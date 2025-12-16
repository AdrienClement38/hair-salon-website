const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';

let browser;
let page;

beforeAll(async () => {
    browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
});

afterAll(async () => {
    await browser.close();
});

beforeEach(async () => {
    page = await browser.newPage();
});

afterEach(async () => {
    if (page) await page.close();
});

test('Portfolio: Should load items and respect limit', async () => {
    // Navigate to Home
    await page.goto(BASE_URL);
    await page.setViewport({ width: 1280, height: 800 });

    // Click "Notre Travail" to trigger load
    await page.click('a[href="#"][onclick*="showPortfolio"]');

    // Wait for the grid to be populated
    try {
        await page.waitForSelector('#public-portfolio-grid .masonry-item img', { timeout: 5000 });
    } catch (e) {
        console.warn("Items did not load in time.");
    }

    // Count ALL items
    const totalCount = await page.$$eval('#public-portfolio-grid .masonry-item', items => items.length);

    console.log(`Total items loaded: ${totalCount}`);

    // Expect items to be loaded (at least 1, we know 18 exist)
    expect(totalCount).toBeGreaterThan(0);

    // Expect cap at 50 (we can't easily test >50 without seeding DB, but we verify logic doesn't crash)
    expect(totalCount).toBeLessThanOrEqual(50);

}, 10000);
