const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Products Management', () => {

    let authHeader;

    beforeAll(async () => {
        await db.initPromise;
        try {
            const hash = await bcrypt.hash('password123', 10);
            await db.createAdmin('prod_mgr', hash, 'Prod Mgr');
        } catch (e) { }
        const token = Buffer.from('prod_mgr:password123').toString('base64');
        authHeader = `Basic ${token}`;
    });

    afterAll(async () => {
        await db.deleteAdmin('prod_mgr');
    });

    test('US-Products: Should retrieve products list (empty by default)', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.products)).toBe(true);
    });

    test('US-Products: Should update products list', async () => {
        const newProducts = [
            { id: 1, name: 'Shampoo', price: 20, description: 'Good stuff', image: 'shampoo.jpg' },
            { id: 2, name: 'Wax', price: 15, description: 'Sticky', image: 'wax.jpg' }
        ];

        const updateRes = await request(app)
            .post('/api/admin/settings')
            .set('Authorization', authHeader)
            .send({ products: newProducts });

        expect(updateRes.statusCode).toBe(200);

        const getRes = await request(app).get('/api/settings');
        expect(getRes.body.products).toHaveLength(2);
        expect(getRes.body.products[0].name).toBe('Shampoo');
    });

});
