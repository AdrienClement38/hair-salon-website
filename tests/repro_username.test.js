const request = require('supertest');
const app = require('../index');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Username Update Reproduction', () => {
    let adminToken;
    let server;
    const initialUsername = 'admin_repro';
    const initialPassword = 'password123';

    // We need to setup a fresh admin for this test
    beforeAll(async () => {
        // Wait for DB init
        await db.initPromise;

        // Ensure user doesn't exist
        await db.deleteAdmin(initialUsername);

        const hash = await bcrypt.hash(initialPassword, 10);
        await db.createAdmin(initialUsername, hash, 'Repro User');

        // Login to get token (or use Basic Auth if that's how it works)
        // The app seems to use Basic Auth or Token? 
        // Admin routes use `checkAuth`. Let's check middleware.
        // Assuming Basic Auth for now based on previous context ("Basic Auth uses the username").
    });

    afterAll(async () => {
        await db.deleteAdmin(initialUsername);
        await db.deleteAdmin('admin_repro_new'); // Cleanup if renamed
    });

    test('should update username via PUT /api/admin/profile', async () => {
        const credentials = Buffer.from(`${initialUsername}:${initialPassword}`).toString('base64');

        // 1. Verify Login works
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: initialUsername, password: initialPassword });
        expect(loginRes.statusCode).toBe(200);

        // 2. Try to update username
        const newUsername = 'admin_repro_new';
        const res = await request(app)
            .put('/api/admin/profile') // This is the route I suspect is correct
            .set('Authorization', `Basic ${credentials}`)
            .send({
                displayName: 'Repro User Updated',
                username: newUsername
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // 3. Verify in DB
        const updatedAdmin = await db.getAdmin(newUsername);
        expect(updatedAdmin).toBeDefined();
        expect(updatedAdmin.username).toBe(newUsername);

        // 4. Verify old username is gone
        const oldAdmin = await db.getAdmin(initialUsername);
        expect(oldAdmin).toBeUndefined();

        // 5. Verify API access with OLD credentials fails (401)
        const resOld = await request(app)
            .get('/api/admin/me')
            .set('Authorization', `Basic ${credentials}`); // Old creds

        expect(resOld.statusCode).toBe(401);

        // 6. Verify API access with NEW credentials works
        const newCredentials = Buffer.from(`${newUsername}:${initialPassword}`).toString('base64');
        const resNew = await request(app)
            .get('/api/admin/me')
            .set('Authorization', `Basic ${newCredentials}`);

        expect(resNew.statusCode).toBe(200);
    });

    test('reproduce frontend failure: PUT /api/admin/me should 404', async () => {
        const credentials = Buffer.from(`${initialUsername}:${initialPassword}`).toString('base64');

        // Note: If the previous test passed, the user is now 'admin_repro_new'.
        // But if it failed, it's matching the user state.
        // Let's rely on success/fail of route.

        const res = await request(app)
            .put('/api/admin/me') // The route I suspect frontend is using erroneousy
            .set('Authorization', `Basic ${credentials}`)
            .send({
                displayName: 'Should Fail',
                username: 'fail_user'
            });

        // Expect 404 because route doesn't exist
        expect(res.statusCode).toBe(404);
    });
});
