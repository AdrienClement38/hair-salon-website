const request = require('supertest');
const app = require('../index');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Admin Profile Updates', () => {
    let adminId;
    const initialUsername = 'testadmin_prof';
    const initialPassword = 'password123';

    // Helper to generate Basic Auth header
    const getAuthHeader = (user, pass) => {
        const str = Buffer.from(`${user}:${pass}`).toString('base64');
        return `Basic ${str}`;
    };

    beforeAll(async () => {
        // Create a test admin
        const hash = await bcrypt.hash(initialPassword, 10);
        const changes = await db.createAdmin(
            initialUsername,
            hash,
            'Test Admin'
        );
        adminId = changes.lastInsertRowid;
    });

    afterAll(async () => {
        // Cleanup
        try {
            await db.deleteAdmin(initialUsername);
            await db.deleteAdmin('testadmin_new');
        } catch (e) { }
    });

    test('Should update display name without changing credentials', async () => {
        const auth = getAuthHeader(initialUsername, initialPassword);

        // Update profile
        const updateRes = await request(app)
            .put('/api/admin/profile')
            .set('Authorization', auth)
            .send({
                username: initialUsername,
                displayName: 'Updated Name',
                new_password: '',
                daysOff: [1]
            });

        expect(updateRes.statusCode).toBe(200);

        // Verify DB
        const worker = await db.getAdminById(adminId);
        expect(worker.display_name).toBe('Updated Name');
        expect(worker.username).toBe(initialUsername);
    });

    test('Should update days off without changing credentials', async () => {
        const auth = getAuthHeader(initialUsername, initialPassword);

        const updateRes = await request(app)
            .put('/api/admin/profile')
            .set('Authorization', auth)
            .send({
                username: initialUsername,
                displayName: 'Updated Name',
                new_password: '',
                daysOff: [2]
            });

        expect(updateRes.statusCode).toBe(200);

        const worker = await db.getAdminById(adminId);
        const daysOff = JSON.parse(worker.days_off);
        expect(daysOff).toContain(2);
    });

    test('Should update username (credential change)', async () => {
        const auth = getAuthHeader(initialUsername, initialPassword);
        const newUsername = 'testadmin_new';

        const updateRes = await request(app)
            .put('/api/admin/profile')
            .set('Authorization', auth)
            .send({
                username: newUsername,
                displayName: 'Updated Name',
                new_password: '',
                daysOff: [2]
            });

        expect(updateRes.statusCode).toBe(200);

        const worker = await db.getAdminById(adminId);
        expect(worker.username).toBe(newUsername);
    });
});
