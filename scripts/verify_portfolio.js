const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const path = require('path');
const fs = require('fs');

async function verifyPortfolio() {
    console.log("Starting Portfolio Verification...");

    // 1. Setup: Ensure database is initialized
    await db.initPromise;

    // Create a dummy image
    const dummyPath = path.join(__dirname, 'dummy_test_image.png');
    fs.writeFileSync(dummyPath, Buffer.from('fakeimagecontent'));

    try {
        // 2. Upload a photo (Admin)
        // Need to authenticate first or mock auth?
        // Ideally we login. But for quick check, let's create a temp admin token or just integration test.
        // Let's use the existing test pattern: create admin, login, get token.

        await db.createAdmin('testadmin', 'hashedpass', 'Test Admin');

        // Login to get session/token if needed, but existing tests use session/cookie.
        // Let's look at `tests/admin_ui.test.js` or `tests/public.test.js`.
        // Actually, `server/routes/api.js` uses `checkAuth`.
        // `checkAuth` checks `req.session.adminId`.

        // Supertest agent persists cookies.
        const agent = request.agent(app);

        // Mock session? In integration tests we usually hit the login endpoint.
        // But login endpoint is `POST /api/login`.
        // Let's try to mock the middleware or just hit login.

        await agent // We need to mock the login or just Insert directly?
        // Let's just USE the DB methods directly to verify DB logic first.
        // Then check Public API.

        console.log("Step 1: Creating item via DB method...");
        await db.saveImage('test_img.png', Buffer.from('data'), 'image/png');
        await db.createPortfolioItem('test_img.png', 'Test Description', 1);

        console.log("Step 2: Verifying via Public API...");
        const res = await request(app).get('/api/portfolio');

        if (res.status !== 200) throw new Error(`API returned ${res.status}`);
        if (!Array.isArray(res.body)) throw new Error("API did not return array");
        if (res.body.length === 0) throw new Error("API returned empty array");
        console.log("Received items:", res.body);

        const item = res.body.find(i => i.filename === 'test_img.png');
        if (!item) throw new Error("Created item not found in API response");
        if (item.description !== 'Test Description') throw new Error("Description mismatch");

        console.log("SUCCESS: Portfolio item verified.");

    } catch (err) {
        console.error("FAILURE:", err);
        process.exit(1);
    } finally {
        // Cleanup if possible?
        fs.unlinkSync(dummyPath);
    }
}

verifyPortfolio();
