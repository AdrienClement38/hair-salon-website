const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Admin Management Tests', () => {

    let authHeader;

    beforeAll(async () => {
        await db.initPromise;

        // Setup initial admin for testing management features directly in DB
        // This avoids API limitations (cannot setup if admin exists) and guarantees user exists
        try {
            const hash = await bcrypt.hash('password123', 10);
            await db.createAdmin('manager', hash, 'Manager');
        } catch (e) {
            // Ignore if already exists (shared DB case)
        }

        // Basic Auth Header
        const token = Buffer.from('manager:password123').toString('base64');
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
                displayName: 'Staff Member'
            });
        if (res.statusCode !== 200) console.log('Create Worker Error:', res.body);
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
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

});
