const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Auth Middleware', () => {
    beforeAll(async () => {
        await db.initPromise;
    });

    it('should return 401 WITHOUT WWW-Authenticate header when unauthenticated', async () => {
        const res = await request(app).get('/api/admin/me');
        expect(res.statusCode).toBe(401);
        expect(res.headers['www-authenticate']).toBeUndefined();
    });
});
