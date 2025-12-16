const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Portfolio API Tests', () => {

    const ADMIN_CREDS = { username: 'portfolio_test_admin', password: 'password123', displayName: 'Portfolio Admin' };
    const AUTH_HEADER = 'Basic ' + Buffer.from(`${ADMIN_CREDS.username}:${ADMIN_CREDS.password}`).toString('base64');

    beforeAll(async () => {
        await db.initPromise;
        // Clean up previous runs if any? In memory DB so fine.
        // Create Admin for Auth
        const hashed = await bcrypt.hash(ADMIN_CREDS.password, 10);
        await db.createAdmin(ADMIN_CREDS.username, hashed, ADMIN_CREDS.displayName);
    });

    test('GET /api/portfolio should return empty array initially', async () => {
        const res = await request(app).get('/api/portfolio');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/admin/portfolio should require auth', async () => {
        const res = await request(app).post('/api/admin/portfolio');
        expect(res.statusCode).toBe(401);
    });

    test('POST /api/admin/portfolio should upload image', async () => {
        const res = await request(app)
            .post('/api/admin/portfolio')
            .set('Authorization', AUTH_HEADER)
            .attach('image', Buffer.from('fakeimagecontent'), { filename: 'test_portfolio_img.png', contentType: 'image/png' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('GET /api/portfolio should list uploaded item', async () => {
        const res = await request(app).get('/api/portfolio');
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        // Controller gens random filename, so just check structure
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('filename');
    });

    test('DELETE /api/admin/portfolio/:id should delete item', async () => {
        // Get list
        const listRes = await request(app).get('/api/portfolio');
        const item = listRes.body[0];
        expect(item).toBeDefined();

        // Delete
        const delRes = await request(app)
            .delete(`/api/admin/portfolio/${item.id}`)
            .set('Authorization', AUTH_HEADER);

        expect(delRes.statusCode).toBe(200);
        expect(delRes.body.success).toBe(true);

        // Verify Gone
        const verifyRes = await request(app).get('/api/portfolio');
        const deletedItem = verifyRes.body.find(i => i.id === item.id);
        expect(deletedItem).toBeUndefined();
    });

});
