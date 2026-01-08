const request = require('supertest');
const app = require('../index');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Frontend Simulation', () => {
    let initialUser = 'sim_user';
    let initialPass = 'pass';

    beforeAll(async () => {
        await db.initPromise;
        const hash = await bcrypt.hash(initialPass, 10);
        await db.deleteAdmin(initialUser);
        await db.deleteAdmin('sim_user_mod');
        await db.createAdmin(initialUser, hash, 'Sim User');
    });

    afterAll(async () => {
        await db.deleteAdmin(initialUser);
        await db.deleteAdmin('sim_user_mod');
    });

    test('Full profile update flow like settings.js', async () => {
        const credentials = Buffer.from(`${initialUser}:${initialPass}`).toString('base64');

        // 1. Load Profile (GET /me)
        const loadRes = await request(app)
            .get('/api/admin/me')
            .set('Authorization', `Basic ${credentials}`);

        expect(loadRes.statusCode).toBe(200);
        expect(loadRes.body.username).toBe(initialUser);

        // 2. Update Profile (PUT /profile) - Mimic settings.js payload
        const newUsername = 'sim_user_mod';
        const payload = {
            displayName: 'Sim User Modified',
            username: newUsername,
            newPassword: '' // empty means no change
        };

        const updateRes = await request(app)
            .put('/api/admin/profile')
            .set('Authorization', `Basic ${credentials}`)
            .send(payload);

        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.body.success).toBe(true);

        // 3. Verify Persistence in DB
        const dbVerify = await db.getAdmin(newUsername);
        expect(dbVerify).toBeDefined();
        expect(dbVerify.username).toBe(newUsername);

        // 4. Verify OLD login fails
        const verifyFail = await request(app)
            .get('/api/admin/me')
            .set('Authorization', `Basic ${credentials}`);
        expect(verifyFail.statusCode).toBe(401);

        // 5. Verify NEW login works
        const newCreds = Buffer.from(`${newUsername}:${initialPass}`).toString('base64');
        const verifySuccess = await request(app)
            .get('/api/admin/me')
            .set('Authorization', `Basic ${newCreds}`);
        expect(verifySuccess.statusCode).toBe(200);
        expect(verifySuccess.body.username).toBe(newUsername);
    });

    test('Worker update flow (PUT /workers/:id)', async () => {
        // Create another worker to update
        const workerUser = 'worker_test';
        const workerPass = 'pass';
        const hash = await bcrypt.hash(workerPass, 10);
        const { lastInsertRowid } = await db.createAdmin(workerUser, hash, 'Worker Test');
        const workerId = lastInsertRowid;

        const credentials = Buffer.from(`sim_user_mod:${initialPass}`).toString('base64'); // Main admin credentials (renamed in previous test)

        // Update Worker
        const newWorkerUser = 'worker_test_mod';
        const res = await request(app)
            .put(`/api/admin/workers/${workerId}`)
            .set('Authorization', `Basic ${credentials}`)
            .send({
                displayName: 'Worker Mod',
                username: newWorkerUser
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify in DB
        const updatedWorker = await db.getAdminById(workerId);
        expect(updatedWorker.username).toBe(newWorkerUser);

        // Cleanup
        await db.deleteAdmin(newWorkerUser);
    });
});
