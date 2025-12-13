const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Contact Info Management', () => {

    let authHeader;

    beforeAll(async () => {
        await db.initPromise;
        // Ensure manager exists for tests
        try {
            const hash = await bcrypt.hash('password123', 10);
            await db.createAdmin('contact_mgr', hash, 'Contact Mgr');
        } catch (e) { }
        const token = Buffer.from('contact_mgr:password123').toString('base64');
        authHeader = `Basic ${token}`;
    });

    afterAll(async () => {
        await db.deleteAdmin('contact_mgr');
    });

    test('US-Contact: Should retrieve contact info settings', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);
        // Expect contact_info to exist (even if strictly empty object or default)
        // We will assume default is created by initDB or controller fallback
        // But for TDD, we expect it to be there.
        expect(res.body).toHaveProperty('contact_info');
    });

    test('US-Contact: Should update contact info', async () => {
        const newInfo = {
            address: '123 TDD Avenue',
            phone: '0102030405'
        };

        const updateRes = await request(app)
            .post('/api/admin/settings')
            .set('Authorization', authHeader)
            .send({ contact_info: newInfo });

        expect(updateRes.statusCode).toBe(200);

        // Verify persistence
        const getRes = await request(app).get('/api/settings');
        expect(getRes.body.contact_info).toEqual(newInfo);
    });

});
