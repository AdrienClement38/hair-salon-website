const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Settings API Security', () => {
    const adminUser = 'admin_security_test';
    const adminPass = 'testpassword123';
    let adminAuthHeader;

    beforeAll(async () => {
        // 1. Create Admin User
        const hashedPassword = await bcrypt.hash(adminPass, 10);
        await db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [adminUser, hashedPassword]);

        // 2. Prepare Basic Auth Header
        const base64Auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64');
        adminAuthHeader = `Basic ${base64Auth}`;

        // 3. Setup initial settings
        await db.setSetting('email_config', {
            user: 'secret_user@test.com',
            pass: 'secret_password',
            host: 'smtp.test.com',
            port: 587
        });
    });

    afterAll(async () => {
        // Clean up
        await db.setSetting('email_config', null);
        await db.run('DELETE FROM admins WHERE username = ?', [adminUser]);
    });

    test('GET /settings (Public) should NOT return sensitive email config', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);

        // Should have the safety flag
        expect(res.body.emailConfigured).toBe(true);

        // Should NOT have the sensitive object
        expect(res.body.email_config).toBeUndefined();
    });

    test('GET /admin/settings (Authenticated) SHOULD return full config', async () => {
        const res = await request(app)
            .get('/api/admin/settings')
            .set('Authorization', adminAuthHeader);

        expect(res.statusCode).toBe(200);

        // Should have the sensitive object
        expect(res.body.email_config).toBeDefined();
        expect(res.body.email_config.user).toBe('secret_user@test.com');
        // Admin gets the full object
        expect(res.body.email_config.pass).toBeDefined();
    });

    test('GET /settings (Public) should return emailConfigured: false if not set', async () => {
        // Clear config
        await db.setSetting('email_config', null);

        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);
        expect(res.body.emailConfigured).toBe(false);
    });
});
