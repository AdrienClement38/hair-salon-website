const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/app');
const { initPromise, createPortfolioItem, createAdmin } = require('../server/models/database');

let server;
let BASE_URL;

describe('Lightbox UX', () => {
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

        // Seed Data
        await createAdmin('admin', 'password', 'Admin');
        await createPortfolioItem('test_image_1.jpg', 'Test Description 1', 1);
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
        await page.setViewport({ width: 1280, height: 800 });
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    test('Lightbox: Portfolio - Open image on click and close', async () => {
        await page.goto(BASE_URL);

        // Click "Notre Travail" to trigger load
        const portfolioLink = await page.$('a[href="#"][onclick*="showPortfolio"]');
        if (portfolioLink) await portfolioLink.click();

        // Wait for items
        await page.waitForSelector('.masonry-item img', { timeout: 10000 });

        const firstImgSrc = await page.$eval('.masonry-item img', img => img.src);

        // Click the first image
        await page.$eval('.masonry-item img', el => el.click());

        await page.waitForSelector('#lightbox-modal', { visible: true });

        // Verify image
        const lightboxImgSrc = await page.$eval('#lightbox-img', img => img.src);
        expect(lightboxImgSrc).toBe(firstImgSrc);

        // Verify Caption HIDDEN for portfolio
        const display = await page.$eval('#lightbox-caption', el => getComputedStyle(el).display);
        expect(display).toBe('none');

        // Close
        await page.mouse.click(10, 10);
        await page.waitForSelector('#lightbox-modal', { hidden: true });

    }, 30000);

    test('Lightbox: Product - Open image with details', async () => {
        await page.goto(BASE_URL);

        // Setup DOM for product test (since Products might be empty in seeded DB)
        await page.evaluate(() => {
            const grid = document.getElementById('products-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="card product-card">
                        <div style="cursor: pointer;" onclick="openLightbox('/images/hero-bg.jpg', 'Test Product', '99', 'Desc')">
                            <img src="/images/hero-bg.jpg" class="test-prod-img">
                        </div>
                        <h3>Test Product</h3>
                    </div>
                `;
            }
        });

        // Find product image
        const prodImg = await page.$('.product-card img');
        if (prodImg) {
            await prodImg.click();

            await page.waitForSelector('#lightbox-modal', { visible: true });

            // Check Content
            const title = await page.$eval('#lightbox-title', el => el.textContent);
            const price = await page.$eval('#lightbox-price', el => el.textContent);

            expect(title).toBe('Test Product');
            expect(price).toContain('99');

            // Close
            await page.mouse.click(10, 10);
            await page.waitForSelector('#lightbox-modal', { hidden: true });
        }
    }, 30000);
});
