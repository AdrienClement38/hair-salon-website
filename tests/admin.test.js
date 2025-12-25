const request = require('supertest');
const app = require('../server/app');

const db = require('../server/models/database');

describe('Admin Auth Tests', () => {

    beforeAll(async () => {
        await db.initPromise;
    });

    test('Admin Flow: Setup or Login depending on DB state', async () => {
        // Check content
        const statusRes = await request(app).get('/api/auth/status');
        expect(statusRes.statusCode).toBe(200);

        if (statusRes.body.setupRequired) {
            // Case 1: Empty DB (or failed load) -> Test Setup
            const setupRes = await request(app).post('/api/auth/setup').send({
                username: 'admin',
                password: 'password123'
            });
            expect(setupRes.statusCode).toBe(200);
            expect(setupRes.body.success).toBe(true);

            // Verify cannot run twice
            const failRes = await request(app).post('/api/auth/setup').send({
                username: 'hacker', password: 'pwd'
            });
            expect(failRes.statusCode).toBe(403);

            // Login
            const loginRes = await request(app).post('/api/auth/login').send({
                username: 'admin', password: 'password123'
            });
            expect(loginRes.statusCode).toBe(200);

        } else {
            // Case 2: Production Clone Loaded -> Test Setup Forbidden + Inject & Login
            console.log("Test running on populated DB: Verifying Locked Setup");

            // Verify Setup Forbidden
            const failRes = await request(app).post('/api/auth/setup').send({
                username: 'hacker', password: 'pwd'
            });
            expect(failRes.statusCode).toBe(403);

            // Inject Custom Admin for Login Test (to avoid guessing prod password)
            const testUser = 'admin_login_test_' + Date.now();
            const hash = await require('bcryptjs').hash('password123', 10);
            await db.createAdmin(testUser, hash, 'Login Test');

            // Test Login with Injected User
            const loginRes = await request(app).post('/api/auth/login').send({
                username: testUser, password: 'password123'
            });
            expect(loginRes.statusCode).toBe(200);
            expect(loginRes.body.success).toBe(true);

            // Test Bad Login
            const badRes = await request(app).post('/api/auth/login').send({
                username: testUser, password: 'wrongpassword'
            });
            expect(badRes.statusCode).toBe(401);
        }
    });

});
