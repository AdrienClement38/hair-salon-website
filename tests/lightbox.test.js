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

test.skip('Lightbox: Open image on click and close on background click', async () => {
    // Navigate to Home
    await page.goto(BASE_URL);

    // Wait for "Notre Travail" link and click it
    console.log("Waiting for portfolio link...");
    await page.waitForSelector('a[href="#"][onclick*="showPortfolio"]', { timeout: 5000 });
    console.log("Clicking portfolio link...");
    await page.click('a[href="#"][onclick*="showPortfolio"]');

    // Inject a dummy item if grid is empty (to test Lightbox UI independently of content)
    await page.evaluate(() => {
        const grid = document.getElementById('public-portfolio-grid');
        if (!grid.hasChildNodes()) {
            const div = document.createElement('div');
            div.className = 'masonry-item';
            div.innerHTML = '<img src="/images/hero-bg.jpg" alt="Test Image">'; // Use an existing image or dummy
            grid.appendChild(div);
        }
    });

    console.log("Waiting for masonry items...");
    await page.waitForSelector('.masonry-item img', { timeout: 10000 });
    console.log("Items found.");

    // Get the src of the first image
    const firstImgSrc = await page.$eval('.masonry-item img', img => img.src);

    // Click the first image
    await page.click('.masonry-item img');

    // Assert: #lightbox-modal is displayed
    await page.waitForSelector('#lightbox-modal', { visible: true });

    // Assert: Image inside lightbox matches clicked image
    const lightboxImgSrc = await page.$eval('#lightbox-img', img => img.src);
    expect(lightboxImgSrc).toBe(firstImgSrc);

    // Click on the background (we need a selector for the background overlay)
    // Assuming #lightbox-modal is the overlay
    await page.click('#lightbox-modal');

    // Assert: Modal is hidden
    await page.waitForSelector('#lightbox-modal', { hidden: true });

}, 30000);
