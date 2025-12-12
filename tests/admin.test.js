const request = require('supertest');
const app = require('../server/app');

const db = require('../server/models/database');

describe('Admin Auth Tests', () => {

    beforeAll(async () => {
        await db.initPromise;
    });

    // US-2.1: Admin Setup
    test('US-2.1: Should return setup required if no admin exists', async () => {
        // Since DB is memory and empty at start
        const res = await request(app).get('/api/auth/status');
        expect(res.statusCode).toBe(200);
        expect(res.body.setupRequired).toBe(true);
    });

    test('US-2.1: Should create first admin', async () => {
        const res = await request(app).post('/api/auth/setup').send({
            username: 'admin',
            password: 'password123'
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('US-2.1: Should NOT allow setup if admin exists', async () => {
        const res = await request(app).post('/api/auth/setup').send({
            username: 'hacker',
            password: 'pwd'
        });
        expect(res.statusCode).toBe(403);
    });

    // US-2.2: Login
    test('US-2.2: Should login with correct credentials', async () => {
        const res = await request(app).post('/api/auth/login').send({
            username: 'admin',
            password: 'password123'
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('US-2.2: Should reject invalid credentials', async () => {
        const res = await request(app).post('/api/auth/login').send({
            username: 'admin',
            password: 'wrongpassword'
        });
        expect(res.statusCode).toBe(401);
    });

});
