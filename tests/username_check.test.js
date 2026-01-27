const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Username Validation', () => {
    beforeAll(async () => {
        await db.initPromise;
        // Ensure known admin exists
        await db.createAdmin('testCheck', 'hash', 'Test Check');
    });

    afterAll(async () => {
        const admin = await db.getAdmin('testCheck');
        if (admin) await db.deleteAdmin(admin.id);
    });

    it('should return exists: true for valid user', async () => {
        const res = await request(app)
            .post('/api/auth/check-username')
            .send({ username: 'testCheck' });

        expect(res.statusCode).toBe(200);
        expect(res.body.exists).toBe(true);
    });

    it('should return exists: false for invalid user', async () => {
        const res = await request(app)
            .post('/api/auth/check-username')
            .send({ username: 'ghostUser' });

        expect(res.statusCode).toBe(200);
        expect(res.body.exists).toBe(false);
    });

    it('should return exists: false for empty username', async () => {
        const res = await request(app)
            .post('/api/auth/check-username')
            .send({ username: '' });

        expect(res.statusCode).toBe(200);
        expect(res.body.exists).toBe(false);
    });
});
