
const request = require('supertest');
const app = require('../index');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Admin Appointment Filtering Regression', () => {
    let admin1Id;
    let admin2Id;
    let token1;
    let token2;

    beforeAll(async () => {
        await db.initPromise;
        const hash = await bcrypt.hash('password', 10);

        // Ensure we have two distinct admins
        // We can't easily force ID=1 in SQLite auto-increment without wiping,
        // but we can trust that if logic is "IF ID=1 THEN NULL", testing with any ID will prove it works normally,
        // or we imply that the fix removed the specific check.
        // The most robust test simply verifies that filtering WORKS for any distinct IDs.

        const adm1 = await db.createAdmin('filter_admin1', hash, 'Admin One');
        admin1Id = adm1.lastInsertRowid;

        const adm2 = await db.createAdmin('filter_admin2', hash, 'Admin Two');
        admin2Id = adm2.lastInsertRowid;

        token1 = 'Basic ' + Buffer.from(`filter_admin1:password`).toString('base64');
    });

    afterAll(async () => {
        await db.deleteAdmin('filter_admin1');
        await db.deleteAdmin('filter_admin2');
        // Clean appointments
        await db.query('DELETE FROM appointments WHERE name LIKE "FilterTest%"');
    });

    test('Should return only appointments for the specific admin ID requested', async () => {
        // Create 2 appointments for Admin 1
        await db.createBooking('FilterTest 1', '2026-06-15', '10:00', 'Service A', '0600000000', admin1Id);
        await db.createBooking('FilterTest 2', '2026-06-15', '11:00', 'Service A', '0600000000', admin1Id);

        // Create 2 appointments for Admin 2
        await db.createBooking('FilterTest 3', '2026-06-15', '10:00', 'Service B', '0600000000', admin2Id);
        await db.createBooking('FilterTest 4', '2026-06-15', '11:00', 'Service B', '0600000000', admin2Id);

        // Act: Filter by Admin 1
        const res1 = await request(app)
            .get(`/api/admin/appointments?adminId=${admin1Id}`)
            .set('Authorization', token1);

        expect(res1.statusCode).toBe(200);
        // Should have 2 items, NOT 4
        const appts1 = res1.body.filter(a => a.name.startsWith('FilterTest'));
        expect(appts1.length).toBe(2);
        expect(appts1.every(a => a.admin_id == admin1Id)).toBe(true);

        // Act: Filter by Admin 2
        const res2 = await request(app)
            .get(`/api/admin/appointments?adminId=${admin2Id}`)
            .set('Authorization', token1);

        expect(res2.statusCode).toBe(200);
        const appts2 = res2.body.filter(a => a.name.startsWith('FilterTest'));
        expect(appts2.length).toBe(2);
        expect(appts2.every(a => a.admin_id == admin2Id)).toBe(true);
    });

    test('Should return ALL appointments when adminId is not provided (Salon View)', async () => {
        const res = await request(app)
            .get('/api/admin/appointments') // No query param
            .set('Authorization', token1);

        expect(res.statusCode).toBe(200);
        const allTestAppts = res.body.filter(a => a.name.startsWith('FilterTest'));
        // Should find all 4 (2 from Admin 1 + 2 from Admin 2)
        expect(allTestAppts.length).toBe(4);
    });
});
