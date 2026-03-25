const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Clients Admin API', () => {
    let adminToken;
    const testEmail = 'api_client_test@example.com';

    beforeAll(async () => {
        await db.initPromise;
        // Clean up
        await db.run("DELETE FROM clients WHERE email = ?", [testEmail]);
        
        // Create an admin for Auth (or use existing if possible)
        // Similar to worker_days_off.test.js
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('password123', 10);
        await db.run("DELETE FROM admins WHERE username = 'admin_api_test'");
        await db.createAdmin('admin_api_test', hash, 'API Test');

        const credentials = Buffer.from('admin_api_test:password123').toString('base64');
        adminToken = `Basic ${credentials}`;

        // Seed a client
        await db.upsertClientLoyalty(testEmail, 'API Client', '0123456789', true);
    });

    afterAll(async () => {
        await db.run("DELETE FROM clients WHERE email = ?", [testEmail]);
        await db.run("DELETE FROM admins WHERE username = 'admin_api_test'");
    });

    test('GET /api/admin/clients should require authentication', async () => {
        const res = await request(app).get('/api/admin/clients');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/admin/clients should return clients list when authenticated', async () => {
        const res = await request(app)
            .get('/api/admin/clients')
            .set('Authorization', adminToken);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find(c => c.email === testEmail);
        expect(found).toBeDefined();
        expect(found.name).toBe('API Client');
    });
});
