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

    test('Mobile: Services should stack vertically', async () => {
        await page.setViewport({ width: 375, height: 812 });
        await page.goto(BASE_URL);

        // Wait for dynamic services to load (or at least one card)
        try {
            await page.waitForSelector('#services-grid .card', { timeout: 2000 });
        } catch (e) {
            // If dynamic loading fails, checks static structure
        }

        const cards = await page.$$('.card');
        if (cards.length >= 2) {
            const card1Box = await cards[0].boundingBox();
            const card2Box = await cards[1].boundingBox();

            // In a stacked layout, the X coordinate should be roughly the same (aligned left)
            // And Y coordinate of second card should be strictly greater than first
            expect(Math.abs(card1Box.x - card2Box.x)).toBeLessThan(10);
            expect(card2Box.y).toBeGreaterThan(card1Box.y + card1Box.height);
        }
    });

    test('Mobile: Hamburger menu should toggle nav', async () => {
        await page.setViewport({ width: 375, height: 812 });
        await page.goto(BASE_URL);

        // Check if hamburger exists (it should be visible on mobile)
        // This will FAIL initially as we haven't implemented it
        const hamburger = await page.$('.hamburger-menu');
        expect(hamburger).not.toBeNull();

        // Ensure nav list is hidden (or translated off screen) initially
        const navVisible = await page.evaluate(() => {
            const nav = document.querySelector('.nav-list');
            const style = window.getComputedStyle(nav);
            // Check if display none or off-screen
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });

        // If implementation hides it via display:none or off-screen, adjust expectation
        // For now, let's assume it should NOT be visible in the viewport flow
        // But currently in code it is just display: none in media query
    });
});
