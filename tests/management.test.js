const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Admin Management Tests', () => {

    let authHeader;
    const dbModel = require('../server/models/database'); // Access internal DB methods

    beforeAll(async () => {
        await dbModel.initPromise;

        // Setup test admin directly via DB to bypass "admin exists" check
        const testUser = 'manager_' + Date.now();
        const hash = await bcrypt.hash('password123', 10);

        // We use the exposed internal run/query or just createAdmin if available
        // createAdmin handles SQL injection based on type
        await dbModel.createAdmin(testUser, hash, 'Manager Test');

        // Basic Auth Header
        const token = Buffer.from(`${testUser}:password123`).toString('base64');
        authHeader = `Basic ${token}`;
    });

    // US-2.14 & US-2.15: Team Management
    test('US-2.14: Should create a new worker', async () => {
        const res = await request(app)
            .post('/api/admin/workers')
            .set('Authorization', authHeader)
            .send({
                username: 'staff1',
                password: 'staffpassword',
                displayName: 'Staff Member',
                daysOff: [1, 2] // Mon, Tue
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify daysOff
        const listRes = await request(app).get('/api/admin/workers').set('Authorization', authHeader);
        const savedWorker = listRes.body.find(w => w.username === 'staff1');
        expect(savedWorker).toBeDefined();
        // Backend returns strings or numbers? usually numbers if JSON.
        // Check exact equality or array containing
        expect(savedWorker.daysOff).toEqual(expect.arrayContaining([1, 2]));
    });

    test('US-2.15: Should prevent duplicate username', async () => {
        // Try creating 'staff1' again
        const res = await request(app)
            .post('/api/admin/workers')
            .set('Authorization', authHeader)
            .send({
                username: 'staff1',
                password: 'newpassword',
                displayname: 'Duplicate Staff'
            });

        // Expecting failure. 500 currently based on DB error logic, or 400 if handled.
        // The fix we made should return a DB error which is caught as 500 usually in controller
        expect(res.statusCode).not.toBe(200);
    });

    // US-2.8: Settings (Hours)
    test('US-2.8: Should update opening hours', async () => {
        const newHours = [
            { isOpen: true, open: '10:00', close: '20:00' } // Sunday
            // ... others implied empty/default or we just send what we want to update if API supports partial?
            // The API expects full array usually.
        ];
        // Mock full array 0-6
        for (let i = 1; i < 7; i++) newHours.push({ isOpen: true, open: '09:00', close: '18:00' });

        const res = await request(app)
            .post('/api/admin/settings')
            .set('Authorization', authHeader)
            .send({ openingHours: newHours });

        expect(res.statusCode).toBe(200);

        // Verify update
        const getRes = await request(app).get('/api/settings');
        expect(getRes.body.openingHours[0].open).toBe('10:00');
    });

    // US-2.10: Services
    test('US-2.10: Should update services', async () => {
        const services = [
            { name: 'Test Cut', price: 99, icon: 'cut', description: 'Test' }
        ];
        const res = await request(app)
            .post('/api/admin/settings')
            .set('Authorization', authHeader)
            .send({ services });

        expect(res.statusCode).toBe(200);

        const getRes = await request(app).get('/api/settings');
        expect(getRes.body.services[0].name).toBe('Test Cut');
    });

    // US-Delete: Worker Deletion (TDD Verification)
    test('Should delete a worker and clean up data', async () => {
        // 1. Create Worker
        const workerData = {
            username: 'todelete_' + Date.now(),
            password: 'password',
            displayName: 'To Delete'
        };

        await request(app)
            .post('/api/admin/workers')
            .set('Authorization', authHeader)
            .send(workerData);

        // Get ID
        const listRes = await request(app).get('/api/admin/workers').set('Authorization', authHeader);
        const worker = listRes.body.find(w => w.username === workerData.username);
        expect(worker).toBeDefined();

        // 2. Delete Worker
        const delRes = await request(app)
            .delete(`/api/admin/workers/${worker.id}`)
            .set('Authorization', authHeader);

        expect(delRes.statusCode).toBe(200);
        expect(delRes.body.success).toBe(true);

        // 3. Verify Gone
        const verifyRes = await request(app).get('/api/admin/workers').set('Authorization', authHeader);
        const exists = verifyRes.body.some(w => w.username === workerData.username);
        expect(exists).toBe(false);
    });

});
