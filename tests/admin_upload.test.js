const request = require('supertest');
const app = require('../server/app.js');
const db = require('../server/models/database.js');
const path = require('path');
const fs = require('fs');

describe('Admin Logo Upload', () => {
    let token;
    let username = 'admin_upload_' + Date.now();
    const bcrypt = require('bcryptjs');

    beforeAll(async () => {
        await db.init();
        try {
            const hash = await bcrypt.hash('password123', 10);
            await db.createAdmin(username, hash, 'Test Admin');
        } catch (e) {
            console.error('Failed to create test user', e);
        }
        token = Buffer.from(`${username}:password123`).toString('base64');
    });

    afterAll(async () => {
        // cleanup
    });

    test('Upload salon-logo updates salon_identity setting', async () => {
        const buffer = Buffer.from('fake-image-content');

        const res = await request(app)
            .post('/api/admin/upload')
            .set('Authorization', 'Basic ' + token)
            .attach('salon-logo', buffer, 'logo.png');

        if (res.status !== 200) {
            console.log('Upload Failed:', res.status, res.body, res.text);
        }

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const settingsRes = await request(app).get('/api/settings').set('Authorization', 'Basic ' + token);
        expect(settingsRes.status).toBe(200);

        const identity = settingsRes.body.salon_identity;
        expect(identity).toBeDefined();
        expect(identity.logo).toBe('salon-logo');
    });
});
