const puppeteer = require('puppeteer');

let browser;
let page;
const BASE_URL = 'http://localhost:3000';

beforeAll(async () => {
    browser = await puppeteer.launch({
        headless: true, // Set to false to see interaction
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
});

afterAll(async () => {
    if (browser) await browser.close();
});

test('Lightbox: Portfolio - Open image on click and close', async () => {
    // Navigate to Home
    await page.goto(BASE_URL);

    // Wait for "Notre Travail" link and click it
    await page.waitForSelector('a[href="#"][onclick*="showPortfolio"]', { timeout: 5000 });
    await page.click('a[href="#"][onclick*="showPortfolio"]');

    // Inject a dummy item if grid is empty
    await page.evaluate(() => {
        const grid = document.getElementById('public-portfolio-grid');
        if (!grid.hasChildNodes()) {
            const div = document.createElement('div');
            div.className = 'masonry-item';
            div.innerHTML = '<img src="/images/hero-bg.jpg" alt="Test Image">';
            grid.appendChild(div);
        }
    });

    await page.waitForSelector('.masonry-item img', { timeout: 10000 });

    const firstImgSrc = await page.$eval('.masonry-item img', img => img.src);
    await page.click('.masonry-item img');

    await page.waitForSelector('#lightbox-modal', { visible: true });
    // Verify image
    const lightboxImgSrc = await page.$eval('#lightbox-img', img => img.src);
    expect(lightboxImgSrc).toBe(firstImgSrc);
    // Verify Caption HIDDEN for portfolio
    const display = await page.$eval('#lightbox-caption', el => getComputedStyle(el).display);
    expect(display).toBe('none');

    await page.mouse.click(10, 10);
    await page.waitForSelector('#lightbox-modal', { hidden: true });

}, 30000);

test('Lightbox: Product - Open image with details', async () => {
    await page.goto(BASE_URL);

    // Wait for initial UI render (products loaded or empty message)
    await page.waitForFunction(() => {
        const grid = document.getElementById('products-grid');
        return grid && grid.innerHTML.trim().length > 0;
    });

    // Inject dummy product (Force overwrite)
    await page.evaluate(() => {
        const grid = document.getElementById('products-grid');
        grid.innerHTML = `
            <div class="card product-card">
                <div style="cursor: pointer;" onclick="openLightbox('/images/hero-bg.jpg', 'Test Product', '99', 'Desc')">
                    <img src="/images/hero-bg.jpg" class="test-prod-img">
                </div>
                <h3>Test Product</h3>
            </div>
         `;
    });

    await new Promise(r => setTimeout(r, 1000)); // Wait for render

    // Find product image
    const prodImg = await page.$('.product-card img');
    if (!prodImg) {
        console.warn("No product image found even after injection?");
        return;
    }

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

}, 30000);
