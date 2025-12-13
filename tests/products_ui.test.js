const puppeteer = require('puppeteer');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = { username: 'prod_tester', password: 'password123', displayName: 'Product Tester' };

// Native fetch Node 18+
const fetch = global.fetch;

describe('Product Management UI', () => {
    let browser;
    let page;
    let db;

    jest.setTimeout(60000);

    beforeAll(async () => {
        // --- DIRECT DB SETUP ---
        const dbPath = path.resolve(__dirname, '../salon.db');
        db = new Database(dbPath);

        // Ensure Test User Exists
        const hash = await bcrypt.hash(TEST_USER.password, 10);
        try {
            const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(TEST_USER.username);
            if (!row) {
                db.prepare('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)').run(TEST_USER.username, hash, TEST_USER.displayName);
            }
        } catch (e) {
            console.error("DB Setup Error:", e);
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
        // Cleanup
        if (db) {
            try {
                db.prepare('DELETE FROM admins WHERE username = ?').run(TEST_USER.username);

                // Optional: Clean up test products if needed, but since we use a dedicated user/environment in theory...
                // Actually, DB is shared. We should cleanup products created by this test if possible, 
                // but for now let's just test the UI state logic which doesn't strictly depend on persistence 
                // if we just manipulate the DOM state.
                // However, we will add a product to test edit.

                db.close();
            } catch (e) {
                console.error("Cleanup failed", e);
            }
        }
    });

    test('Should handle Product Edit UX correctly (Button text changes, Cancel button)', async () => {
        await page.goto(`${BASE_URL}/admin.html`);

        // Login
        await page.type('#username', TEST_USER.username);
        await page.type('#password', TEST_USER.password);
        await page.click('#login-form button[type="submit"]');

        // Wait for dashboard
        await page.waitForSelector('#dashboard-view', { visible: true });

        // Go to Content Tab where Products are located (based on recent code changes, Products are in Content tab, or separate?)
        // Let's check admin.html content... Products section is in #tab-content
        await page.click('#btn-tab-content, #tab-btn-content');
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
        const btnSelector = '#products-list + div button';
        // Or robustly finding it if selector is complex.
        // Based on recent code: getElementById('products-list').nextElementSibling.querySelector('button')

        let btnText = await page.evaluate(() => {
            const container = document.getElementById('products-list').nextElementSibling;
            return container.querySelector('button').textContent;
        });
        expect(btnText).toBe('Ajouter le produit');

        // Click Add
        await page.click(btnSelector); // or find by text path xpath

        // Wait for list update (product appears)
        await page.waitForFunction(() => {
            return document.body.innerText.includes('Test Product UI');
        });

        // Find the "Modifier" button for the new product
        // It's likely the last one.
        const editBtns = await page.$$('.btn-edit');
        const lastEditBtn = editBtns[editBtns.length - 1]; // Assuming it's appended at end or we find by text

        if (!lastEditBtn) throw new Error("Edit button not found");

        // Click Edit
        await lastEditBtn.click();

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
        const deleteBtns = await page.$$('.btn-delete, button[title="Supprimer"]'); // checking selectors from code
        // The delete button in products.js is: button title="Supprimer" with red color.

        // Find the specific delete button for our product
        // We can look for the row containing 'Test Product UI'
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
    });
});
