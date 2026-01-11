const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const jwt = require('jsonwebtoken');

describe('Settings Deletion API', () => {
    let adminTokenHeader;
    const adminUser = 'admin_del_test';

    // We use Basic Auth as used in middleware
    const adminPass = 'delpass';

    beforeAll(async () => {
        // 1. Create Admin
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(adminPass, 10);
        await db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [adminUser, hashedPassword]);
        const base64Auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64');
        adminTokenHeader = `Basic ${base64Auth}`;

        // 2. Set Config
        await db.setSetting('email_config', { user: 'foo', pass: 'bar' });
    });

    afterAll(async () => {
        await db.setSetting('email_config', null);
        await db.run('DELETE FROM admins WHERE username = ?', [adminUser]);
    });

    test('POST /settings with email_config: null should delete config', async () => {
        // Verify it exists first
        let current = await db.getSetting('email_config');
        expect(current).not.toBeNull();

        // Send Delete Request
        const res = await request(app)
            .post('/api/admin/settings')
            .set('Authorization', adminTokenHeader)
            .send({ email_config: null });

        expect(res.statusCode).toBe(200);

        // Verify it is gone
        current = await db.getSetting('email_config');
        expect(current).toBeNull();
    });

    test('POST /api/settings with empty object should NOT delete if logic is flawed (regression check)', async () => {
        // Reset
        await db.setSetting('email_config', { user: 'foo', pass: 'bar' });

        // If I send { other_setting: 'val' }, email_config should NOT be deleted
        const res = await request(app)
            .post('/api/admin/settings')
            .set('Authorization', adminTokenHeader)
            .send({ salon_identity: { name: 'Test' } }); // email_config undefined here

        expect(res.statusCode).toBe(200);

        const current = await db.getSetting('email_config');
        expect(current).not.toBeNull();
    });
});
