const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/app');
const { initPromise } = require('../server/models/database');

let server;
let BASE_URL;

describe('Layout Tests', () => {
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
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    test('Services Grid should be centered', async () => {
        await page.goto(BASE_URL);

        // Wait for grid to exist (static HTML part)
        await page.waitForSelector('#services-grid');

        // Check computed style
        const styles = await page.evaluate(() => {
            const grid = document.getElementById('services-grid');
            const style = window.getComputedStyle(grid);
            return {
                display: style.display,
                justifyContent: style.justifyContent,
                flexWrap: style.flexWrap
            };
        });

        expect(styles.display).toBe('flex');
        expect(styles.justifyContent).toBe('center');
        expect(styles.flexWrap).toBe('wrap');
    });
});
