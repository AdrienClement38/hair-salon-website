const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Logo Management APIs', () => {
    let token;

    beforeAll(async () => {
        await db.initPromise;
        
        const bcrypt = require('bcryptjs');
        
        // Create an admin user for the test if none exists
        const admin = await db.getAdminByUsername('testadmin_logo');
        if (!admin) {
            const hash = await bcrypt.hash('password123', 10);
            await db.createAdmin('testadmin_logo', hash, 'admin');
        }

        // The auth middleware expects Base64 encoded username:password
        token = Buffer.from('testadmin_logo:password123').toString('base64');
    });

    afterAll(async () => {
        try {
            await db.run("DELETE FROM admins WHERE username = 'testadmin_logo'");
        } catch(e) {}
    });

    test('DELETE /api/admin/logo should effectively remove the logo setting', async () => {
        // 1. First inject a dummy logo into settings
        const initialIdentity = { name: 'Test Salon', logo: 'salon-logo' };
        await db.setSetting('salon_identity', initialIdentity);

        // 2. Call the endpoint
        const response = await request(app)
            .delete('/api/admin/logo')
            .set('Authorization', `Bearer ${token}`);

        // 3. Verify it worked
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // 4. Verify DB was updated
        const updatedIdentity = await db.getSetting('salon_identity');
        expect(updatedIdentity.logo).toBeNull();
    });
});
