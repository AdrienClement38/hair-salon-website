const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';

describe('Mobile UX Tests', () => {
    let browser;
    let page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
    });

    afterAll(async () => {
        await browser.close();
    });

    test('Mobile: Page should not have horizontal scroll', async () => {
        // iPhone X Viewport
        await page.setViewport({ width: 375, height: 812 });
        await page.goto(BASE_URL);

        // Wait for content to load
        await page.waitForSelector('.hero');

        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);

        // Allow a tiny margin of error (e.g., 1px) due to sub-pixel rendering, but generally equal
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test('Mobile: Services should be displayed horizontally (slider)', async () => {
        await page.setViewport({ width: 375, height: 812 });
        await page.goto(BASE_URL);

        // Wait for dynamic services to load
        try {
            await page.waitForSelector('#services-grid .item-card', { timeout: 2000 });
        } catch (e) {
            // Ignore
        }

        const cards = await page.$$('#services-grid .item-card');
        if (cards.length >= 2) {
            const card1Box = await cards[0].boundingBox();
            const card2Box = await cards[1].boundingBox();

            // In horizontal slider:
            // Y coordinates should be roughly aligned (same row)
            expect(Math.abs(card1Box.y - card2Box.y)).toBeLessThan(10);

            // X coordinate of second card should be strictly greater than first
            expect(card2Box.x).toBeGreaterThan(card1Box.x);
        }
    });

    test('Mobile: Hamburger menu should toggle nav', async () => {
        await page.setViewport({ width: 375, height: 812 });
        await page.goto(BASE_URL);

        const hamburger = await page.$('.hamburger-menu');
        expect(hamburger).not.toBeNull();

        // Initially nav should be off-screen
        const navBoxInit = await page.$eval('.nav-list', el => {
            const rect = el.getBoundingClientRect();
            return { x: rect.x, width: rect.width };
        });
        // Check if it's off-screen (right: -100%) -> x should be approx viewport width or greater
        // Or check if class active is absent
        const hasActiveClassInit = await page.$eval('.nav-list', el => el.classList.contains('active'));
        expect(hasActiveClassInit).toBe(false);

        // Click hamburger
        await hamburger.click();

        // Wait for animation
        await new Promise(r => setTimeout(r, 500));

        // Check if active class is added
        const hasActiveClassAfter = await page.$eval('.nav-list', el => el.classList.contains('active'));
        expect(hasActiveClassAfter).toBe(true);

        // Check visibility (on screen)
        const navBoxAfter = await page.$eval('.nav-list', el => {
            const rect = el.getBoundingClientRect();
            return { x: rect.x, right: rect.right };
        });

        // Should be at right: 0, so right edge approx 375
        expect(navBoxAfter.right).toBeCloseTo(375, -1); // within 10px
    });
});
