const puppeteer = require('puppeteer');
const http = require('http');
const app = require('../server/app');
const { initPromise } = require('../server/models/database');

let server;
let BASE_URL;

describe('Frontend Error Display', () => {
    jest.setTimeout(60000);
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
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    test.skip('Should display error message in red when phone number is invalid', async () => {
        await page.goto(`${BASE_URL}`);

        // Scroll to booking section
        // Assuming there's a link or we just scroll
        // The booking form is on the main page
        await page.waitForSelector('#booking-form');

        // Fill Form
        await page.type('#name', 'Error Test User');
        await page.type('#phone', 'invalid-phone'); // Invalid

        // Use evaluate to set non-text inputs if needed, or typed if they are standard inputs
        // Service might be a select, need to wait for it to load
        await page.waitForSelector('#service option:not([value=""])'); // Wait for services to load
        await page.select('#service', await page.$eval('#service option:nth-child(2)', el => el.value));

        // Date and Worker
        await page.type('#date', '2025-12-29'); // Future date
        await page.waitForSelector('#worker option:not([value=""])');
        await page.select('#worker', await page.$eval('#worker option:nth-child(2)', el => el.value));

        // Wait for slots (might not load if date invalid, but date is valid)
        // We just want to submit. But validation might happen on submit.
        // If we don't pick a time, it might complain about time first.
        // Let's pick a time if available.
        try {
            await page.waitForSelector('.slot-btn:not(.disabled)', { timeout: 2000 });
            await page.click('.slot-btn:not(.disabled)');
        } catch (e) {
            // If no slots, proceed (submit might fail due to missing time which is also an error)
            // But we want to test PHONE error. 
            // If phone is invalid, backend (or frontend?) should check it.
            // Frontend validation might be HTML5?
            // "refactor... du message d'erreur" implies checking the CUSTOM message box.
        }

        // We explicitly test phone, so let's try to trigger it.
        // If we don't pick a time, we might get "Veuillez sélectionner un créneau".
        // We need to bypass that if possible, or ensure we pick a time.
        // But if slots don't load, we can't pick time.

        // Actually, let's just assert that submitting 'invalid-phone' eventually triggers a phone error 
        // OR if the input itself shows error.

        // Wait, if I submit without time, I get "Veuillez sélectionner un créneau".
        // I need to select a time to reach the Phone validation (unless phone is validated BEFORE time).
        // The backend validates everything.
        // So I must pick a time.

        // Mock slots/availablity? 
        // Or trust that 2025-12-29 has slots.

        // Click Submit
        await page.click('#booking-form button[type="submit"]');

        // Check #form-message
        await page.waitForSelector('#form-message', { visible: true });

        // Get text and color
        const message = await page.$eval('#form-message', el => el.textContent);
        const color = await page.$eval('#form-message', el => el.style.color);

        // We expect an error. 
        // If we didn't pick a time, it says "Veuillez sélectionner un créneau".
        // If we DID pick a time, it should say "Numéro invalide...".

        // Since getting a slot is complex in a test without seeding, 
        // maybe we can mock the fetch to /api/book?
        // Puppeteer request interception!
    });

    test('Should display specific phone error in red', async () => {
        // Intercept API calls to force a specific error response even if UI flow isn't perfect
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (req.url().includes('/api/book') && req.method() === 'POST') {
                req.respond({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Numéro invalide (doit contenir 10 chiffres)' })
                });
            } else {
                req.continue();
            }
        });

        await page.goto(`${BASE_URL}`);

        // Avoid alert/check for time by forcefully calling the submit logic?
        // Or just filling minimums.
        await page.type('#name', 'Test');

        // Fill required fields to pass HTML5 validation
        // We can just set values directly or type
        // Set date safely via JS
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        await page.evaluate((d) => {
            document.getElementById('date').value = d;
        }, tomorrowStr);

        // Wait for selects to populate (though we intercept request, they might still be empty if load fails?)
        // The real backend IS running during this test (we start app), so they should load.
        // Or we can just force values into DOM to bypass select validation? 
        // Better to wait for options if possible, or just set innerHTML if waiting is flaky.
        // But let's try just setting value if options exist.
        // Actually, easiest is to just inject options if they are missing or just remove 'required' attribute.
        // But cleaner to just fill them.

        // Remove required attributes to simplify test flow (we only care about response handling)
        await page.evaluate(() => {
            document.getElementById('service').removeAttribute('required');
            document.getElementById('worker').removeAttribute('required');
            document.getElementById('date').removeAttribute('required');
            document.getElementById('phone').removeAttribute('required'); // Should still send value?
            // checking phone validation display, so we want phone input to be populated or not?
            // Code sends value.
        });

        // Set phone to something invalid but submitted
        await page.type('#phone', 'invalid');

        await page.evaluate(() => {
            document.getElementById('selected-time').value = '10:00';
        });

        // Use evaluate to click to avoid "Node is not clickable" (e.g. cookie banner overlay)
        await page.evaluate(() => {
            const btn = document.querySelector('#booking-form button[type="submit"]');
            if (btn) btn.click();
        });

        await page.waitForFunction(() => {
            const el = document.querySelector('#form-message');
            return el && el.textContent.includes('Numéro invalide');
        }, { timeout: 10000 });

        const color = await page.$eval('#form-message', el => el.style.color);
        expect(color).toBe('red');
    });

});
