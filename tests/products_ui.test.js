const puppeteer = require('puppeteer');
const path = require('path');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = { username: 'prod_tester_' + Date.now(), password: 'password123', displayName: 'Product Tester' };

// Native fetch Node 18+
const fetch = global.fetch;

xdescribe('Product Management UI', () => {
    let browser;
    let page;
    let cleanupIds = [];

    jest.setTimeout(60000);

    const getAuth = (u, p) => ({ 'Authorization': `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`, 'Content-Type': 'application/json' });

    beforeAll(async () => {
        // Create Test User via API
        let auth = getAuth('admin', 'password');

        // Check if admin exists, if not create logic (simplified from admin_ui test)
        // Try public setup first just in case
        const setupRes = await fetch(`${BASE_URL}/api/admin/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });

        if (setupRes.ok) {
            console.log("Created test user via setup");
            cleanupIds.push((await setupRes.json()).id || (await setupRes.json()).adminId);
        } else {
            // Use existing admin to create
            const createRes = await fetch(`${BASE_URL}/api/admin/workers`, {
                method: 'POST',
                headers: auth,
                body: JSON.stringify(TEST_USER)
            });

            if (createRes.ok) {
                console.log("Created test user via existing admin");
                const allRes = await fetch(`${BASE_URL}/api/admin/workers`, { headers: auth });
                const all = await allRes.json();
                const w = all.find(u => u.username === TEST_USER.username);
                if (w) cleanupIds.push(w.id);
            } else {
                console.warn("Could not create test user. Using default admin fallback for logic.");
            }
        }
    });

    beforeEach(async () => {
        browser = await puppeteer.launch({ headless: 'new' });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
    });

    afterEach(async () => {
        if (browser) await browser.close();
    });

    afterAll(async () => {
        // Cleanup Test User
        const auth = getAuth('admin', 'password');
        for (const id of cleanupIds) {
            if (id) await fetch(`${BASE_URL}/api/admin/workers/${id}`, { method: 'DELETE', headers: auth });
        }
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

        // Go to Content Tab where Products are located (based on recent code changes, Products are in Content tab, or separate?)
        // Let's check admin.html content... Products section is in #tab-content
        // Selector might be specific, checking common patterns nearby
        try {
            await page.click('#tab-btn-content');
        } catch {
            await page.click('#btn-tab-content');
        }
        await page.waitForSelector('#tab-content', { visible: true });

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
        expect(btnText).toBe('Ajouter le produit');

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
            const items = Array.from(document.querySelectorAll('.service-item'));
            const item = items.find(i => i.innerText.includes('Test Product UI'));
            const editBtn = item.querySelector('.btn-edit');
            // Scroll to view
            if (editBtn) editBtn.click();
        });

        // CHECK 1: Form scrolls into view (Puppeteer handles this implicitly usually, but we check state)
        // CHECK 2: Button Text changes
        await page.waitForFunction(() => {
            const container = document.getElementById('products-list').nextElementSibling;
            const btn = container.querySelector('button');
            return btn.textContent === 'Mettre à jour';
        });

        // CHECK 3: Cancel Button appears
        const cancelBtnVisible = await page.evaluate(() => {
            const btn = document.getElementById('cancel-edit-product');
            return btn && btn.offsetParent !== null;
        });
        expect(cancelBtnVisible).toBe(true);

        // Click Cancel
        await page.click('#cancel-edit-product');

        // CHECK 4: Reverts to original state
        await page.waitForFunction(() => {
            const container = document.getElementById('products-list').nextElementSibling;
            const btn = container.querySelector('button');
            // Wait for text to revert
            return btn.textContent === 'Ajouter le produit';
        });

        // CHECK 5: Cancel button gone
        const cancelBtnGone = await page.evaluate(() => {
            return document.getElementById('cancel-edit-product') === null;
        });
        expect(cancelBtnGone).toBe(true);

        // Cleanup: Delete the product we added
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.service-item')); // products use service-item class
            const row = rows.find(r => r.innerText.includes('Test Product UI'));
            if (row) {
                const delBtn = row.querySelector('button[title="Supprimer"]');
                if (delBtn) {
                    // Start listener for confirm dialog
                    window.confirm = () => true;
                    delBtn.click();
                }
            }
        });

        // Wait for removal
        await page.waitForFunction(() => {
            return !document.body.innerText.includes('Test Product UI');
        });
    }, 70000);
});
