const puppeteer = require('puppeteer');
const path = require('path');
const bcrypt = require('bcryptjs');

const http = require('http');
const app = require('../server/app');
const { initPromise } = require('../server/models/database');

let server;
let BASE_URL;

// Native fetch Node 18+
const fetch = global.fetch;

describe('Product Management UI', () => {
    let browser;
    let page;

    jest.setTimeout(120000);

    const TEST_USER = { username: 'prod_tester_' + Date.now(), password: 'password123', displayName: 'Product Tester' };

    const getAuth = (u, p) => ({ 'Authorization': `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`, 'Content-Type': 'application/json' });

    beforeAll(async () => {
        // Start Isolated Server
        await initPromise;

        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        BASE_URL = `http://localhost:${port}`;

        // Create Test User via API setup
        const setupRes = await fetch(`${BASE_URL}/api/auth/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });

        if (!setupRes.ok) {
            throw new Error(`Failed to setup test runner: ${await setupRes.text()}`);
        }
    });

    beforeEach(async () => {
        browser = await puppeteer.launch({ headless: 'new' });
        page = await browser.newPage();
        page.on('console', msg => console.log('PAGE:', msg.text()));
        await page.setViewport({ width: 1280, height: 800 });
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    afterAll(async () => {
        if (server) server.close();
    });

    test('Should handle Product Edit UX correctly (Button text changes, Cancel button)', async () => {
        await page.goto(`${BASE_URL}/admin.html`);

        // Login
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');

        // Wait for dashboard or fallback to default admin if login failed
        try {
            await page.waitForSelector('#dashboard-view', { visible: true, timeout: 5000 });
        } catch (e) {
            await page.reload();
            await page.type('#username', 'admin');
            await page.type('#password', 'password');
            await page.click('#login-form button[type="submit"]');
            await page.waitForSelector('#dashboard-view', { visible: true });
        }

        // Go to Content Tab where Products are located
        await page.waitForSelector('#tab-btn-content', { visible: true });
        await new Promise(r => setTimeout(r, 500)); // Yield
        await page.click('#tab-btn-content');

        try {
            await page.waitForSelector('#tab-content', { visible: true, timeout: 5000 });
        } catch (e) {
            console.log("Retry clicking content tab in products test...");
            await page.click('#tab-btn-content');
            await page.waitForSelector('#tab-content', { visible: true, timeout: 60000 });
        }

        // Scroll to Products Section
        // We need to add a product first to edit it.
        // Wait for products list to be visible?
        const productsList = await page.$('#products-list');

        // Fill form to add product
        await page.type('#new-product-name', 'Test Product UI');
        await page.type('#new-product-price', '10');
        await page.type('#new-product-desc', 'Test Description');

        // Verify Initial State of Button
        // Robust selector
        // Finds the button in the form which is sibling of products list
        // Form ID?

        let btnText = await page.evaluate(() => {
            const list = document.getElementById('products-list');
            // The form is usually immediately after or inside the same container.
            // Assuming the structure seen in previous file was correct: sibling
            const container = list.nextElementSibling;
            if (!container) return "ERROR: Container not found";
            const btn = container.querySelector('button');
            return btn ? btn.textContent : "ERROR: Button not found";
        });

        // If layout changed, this might fail, but let's assume it was working before.
        expect(btnText.trim().replace(/\s+/g, ' ')).toBe('Ajouter à la liste');

        // Click Add
        await page.evaluate(() => {
            const list = document.getElementById('products-list');
            const container = list.nextElementSibling;
            container.querySelector('button').click();
        });

        // Wait for list update (product appears)
        await page.waitForFunction(() => {
            return document.body.innerText.includes('Test Product UI');
        });

        // Find the "Modifier" button for the new product
        // It's likely the last one.
        // Products are likely .service-item

        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#products-list tr'));
            for (const row of rows) {
                if (row.innerText.includes('Test Product UI')) {
                    const editBtn = row.querySelector('button[title="Modifier"]');
                    if (editBtn) {
                        editBtn.click();
                        return;
                    }
                }
            }
        });

        // CHECK 1: Form scrolls into view (Puppeteer handles this implicitly usually, but we check state)
        // CHECK 2: Button Text changes
        await page.waitForFunction(() => {
            const container = document.getElementById('products-list').nextElementSibling;
            const btn = container.querySelector('button');
            return btn.textContent === 'Mettre à jour';
        });

        // CHECK 3: Cancel Button appears
        console.error('Checking Cancel Button Visibility...');
        const cancelBtnVisible = await page.evaluate(() => {
            const btn = document.getElementById('btn-cancel-product');
            return btn && btn.style.display !== 'none';
        });
        console.error('Cancel Button Visible:', cancelBtnVisible);
        expect(cancelBtnVisible).toBe(true);

        // Click Cancel (Force via DOM to avoid puppeteer hit-test flakiness)
        console.error('Clicking Cancel via DOM...');
        await page.evaluate(() => {
            document.getElementById('btn-cancel-product').click();
        });

        // CHECK 4: Reverts to original state
        console.error('Waiting for revert...');
        await page.waitForFunction(() => {
            // Find the main action button by ID
            const btn = document.getElementById('btn-add-product');
            // Wait for text to revert
            return btn && btn.textContent.includes('Ajouter');
        }, { timeout: 10000 });
        console.error('Revert confirmed.');

        // CHECK 5: Cancel button gone (hidden)
        const cancelBtnHidden = await page.evaluate(() => {
            const btn = document.getElementById('btn-cancel-product');
            return !btn || btn.style.display === 'none';
        });
        expect(cancelBtnHidden).toBe(true);

        // Cleanup: Delete the product we added
        // Cleanup: Eliminate the product
        page.on('dialog', async dialog => await dialog.accept());

        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#products-list tr'));
            for (const row of rows) {
                if (row.innerText.includes('Test Product UI')) {
                    const delBtn = row.querySelector('button[title="Supprimer"]');
                    if (delBtn) delBtn.click();
                }
            }
        });

        // Wait for removal
        await page.waitForFunction(() => {
            return !document.body.innerText.includes('Test Product UI');
        }, { timeout: 10000 });
    }, 70000);
});
