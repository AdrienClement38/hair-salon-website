const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';

jest.setTimeout(45000); // Increase timeout for E2E

describe('Theme System E2E', () => {
    let browser;
    let page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();

        // Listen to console logs
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        await page.setViewport({ width: 1280, height: 800 });
    });

    afterAll(async () => {
        // Reset to default
        if (page) {
            await page.goto(BASE_URL + '/admin.html');
            await page.evaluate(async () => {
                const auth = btoa('admin:admin');
                await fetch('/api/admin/settings', { // Corrected URL
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({ active_theme: 'default' })
                });
            });
        }
        if (browser) await browser.close();
    });

    test('Frontend should load active_theme from API and apply data-theme attribute', async () => {
        // 1. Set theme to 'red-black' via API
        const testTheme = 'red-black';
        console.log(`Setting active_theme to ${testTheme} via API...`);

        await page.goto(BASE_URL + '/admin.html');
        await page.evaluate(async (theme) => {
            const auth = btoa('admin:admin');
            const res = await fetch('/api/admin/settings', { // Corrected URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify({ active_theme: theme })
            });
            if (!res.ok) throw new Error('API request failed: ' + res.status);
        }, testTheme);

        // 2. Navigate to Client Home and Check
        console.log('Navigating to home page...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

        // Wait for attribute to appear (it's async in script)
        try {
            await page.waitForFunction((expected) => {
                return document.documentElement.getAttribute('data-theme') === expected;
            }, { timeout: 5000 }, testTheme);
        } catch (e) {
            console.log('Timeout waiting for data-theme attribute. Current:', await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
        }

        // 3. Verify Attribute
        const themeAttr = await page.evaluate(() => {
            return document.documentElement.getAttribute('data-theme');
        });
        expect(themeAttr).toBe(testTheme);

        // 4. Verify Computed Color (Red)
        // #e74c3c -> rgb(231, 76, 60)
        const computedColor = await page.evaluate(() => {
            const el = document.querySelector('.text-gold');
            return window.getComputedStyle(el).color;
        });
        expect(computedColor).toBe('rgb(231, 76, 60)');
    });

    test('Frontend should fallback to default theme if setting is default', async () => {
        // 1. Set theme to 'default' via API
        await page.goto(BASE_URL + '/admin.html');
        await page.evaluate(async () => {
            const auth = btoa('admin:admin');
            await fetch('/api/admin/settings', { // Corrected URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify({ active_theme: 'default' })
            });
        });

        // 2. Reload Client
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

        // 3. Verify Attribute
        // If API returns 'default', it sets 'default'.
        const themeAttr = await page.evaluate(() => {
            return document.documentElement.getAttribute('data-theme');
        });
        expect(themeAttr).toBe('default');

        // 4. Verify Color (Gold)
        // #D4AF37 -> rgb(212, 175, 55)
        const computedColor = await page.evaluate(() => {
            const el = document.querySelector('.text-gold');
            return window.getComputedStyle(el).color;
        });
        expect(computedColor).toBe('rgb(212, 175, 55)');
    });
});
