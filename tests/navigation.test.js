const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/app');
const { initPromise } = require('../server/models/database');

let server;
let BASE_URL;

describe('Navigation Shortcuts & Routing', () => {
    let browser;
    let page;

    beforeAll(async () => {
        await initPromise;
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        BASE_URL = `http://localhost:${port}`;
    });

    afterAll(async () => {
        if (server) server.close();
    });

    beforeEach(async () => {
        browser = await puppeteer.launch({ headless: 'new' });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(BASE_URL);
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    test('Initial State: Home sections should be visible, Portfolio hidden', async () => {
        const heroVisible = await page.evaluate(() => {
            const hero = document.querySelector('section.hero');
            return hero && hero.style.display !== 'none';
        });
        const portfolioVisible = await page.evaluate(() => {
            const p = document.getElementById('portfolio-section');
            return p && p.style.display !== 'none';
        });

        expect(heroVisible).toBe(true);
        expect(portfolioVisible).toBe(false);
    });

    test('Navigation: "Notre Travail" should hide Home and show Portfolio', async () => {
        // Click "Notre Travail" link
        // Selector: text content "Notre Travail" inside nav
        const link = await page.waitForSelector('xpath///a[contains(text(), "Notre Travail")]');
        await link.click();

        // Wait for portfolio section to be visible
        await page.waitForFunction(() => {
            const p = document.getElementById('portfolio-section');
            return p && p.style.display === 'block';
        });

        // Verify Hero is hidden
        const heroHidden = await page.evaluate(() => {
            const hero = document.querySelector('section.hero');
            return hero.style.display === 'none';
        });
        expect(heroHidden).toBe(true);
    });

    test('Navigation: "Le Salon" from Portfolio should return to Home', async () => {
        // 1. Go to Portfolio first
        const portfolioLink = await page.waitForSelector('xpath///a[contains(text(), "Notre Travail")]');
        await portfolioLink.click();
        await page.waitForFunction(() => document.getElementById('portfolio-section').style.display === 'block');

        // 2. Click "Le Salon" (which is now href="#")
        const salonLink = await page.waitForSelector('xpath///a[contains(text(), "Le Salon")]');
        await salonLink.click();

        // 3. Verify Home is back
        await page.waitForFunction(() => {
            const hero = document.querySelector('section.hero');
            return hero && hero.style.display !== 'none';
        });

        // Verify Hero has correct display type (flex, not block)
        const heroDisplay = await page.evaluate(() => {
            const hero = document.querySelector('section.hero');
            return window.getComputedStyle(hero).display;
        });
        expect(heroDisplay).toBe('flex');

        // Verify Portfolio is hidden
        const portfolioHidden = await page.evaluate(() => {
            const p = document.getElementById('portfolio-section');
            return p.style.display === 'none';
        });
        expect(portfolioHidden).toBe(true);
    });

    test('Navigation: "Prestations" from Portfolio should return to Home and scroll', async () => {
        // 1. Go to Portfolio
        const portfolioLink = await page.waitForSelector('xpath///a[contains(text(), "Notre Travail")]');
        await portfolioLink.click();
        await page.waitForFunction(() => document.getElementById('portfolio-section').style.display === 'block');

        // 2. Click "Prestations"
        const servicesLink = await page.waitForSelector('xpath///a[contains(text(), "Prestations")]');
        await servicesLink.click();

        // 3. Verify Home is back (specifically Services section should be visible/block, but main layout restored)
        await page.waitForFunction(() => {
            const hero = document.querySelector('section.hero');
            const services = document.getElementById('services');
            // Check if hero is visible (meaning main layout is restored)
            return hero && hero.style.display !== 'none' && services.style.display !== 'none';
        });
    });

    test('Navigation: "Produits" from Portfolio should return to Home', async () => {
        // 1. Go to Portfolio
        const portfolioLink = await page.waitForSelector('xpath///a[contains(text(), "Notre Travail")]');
        await portfolioLink.click();
        await page.waitForFunction(() => document.getElementById('portfolio-section').style.display === 'block');

        // 2. Click "Produits"
        const productsLink = await page.waitForSelector('xpath///a[contains(text(), "Produits")]');
        await productsLink.click();

        // 3. Verify Home is back
        await page.waitForFunction(() => {
            const hero = document.querySelector('section.hero');
            return hero && hero.style.display !== 'none';
        });
    });
});
