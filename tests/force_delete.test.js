const request = require('supertest');
const app = require('../index');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Auto-Cancellation Force Delete', () => {
    let adminId;
    let appointmentId;
    const adminUsername = 'forcedel_test';

    beforeAll(async () => {
        // Create admin
        const hash = await bcrypt.hash('password', 10);
        const changes = await db.createAdmin(
            adminUsername,
            hash,
            'Force Delete Admin'
        );
        adminId = changes.lastInsertRowid;
    });

    afterAll(async () => {
        try {
            await db.deleteAdmin(adminUsername);
        } catch (e) { }
    });

    // Helper for Auth
    const getAuth = () => 'Basic ' + Buffer.from(`${adminUsername}:password`).toString('base64');

    test('Should delete appointment without email when forceDelete is true', async () => {
        // Create Appointment NO EMAIL
        const booking = await db.createBooking(
            'No Email Client',
            '2026-06-01',
            '10:00',
            'Coupe',
            '0600000000',
            adminId,
            '' // No email
        );
        const apptId = booking.lastInsertRowid;

        // Verify exists
        const listPre = await request(app).get('/api/admin/appointments').set('Authorization', getAuth());
        const existsPre = listPre.body.find(a => a.id === apptId);
        expect(existsPre).toBeDefined();

        // Create Leave with forceDelete: true
        const res = await request(app)
            .post('/api/admin/leaves')
            .set('Authorization', getAuth())
            .send({
                start: '2026-06-01',
                end: '2026-06-01',
                adminId: adminId,
                note: 'Force Leave',
                sendEmails: false, // User said NO to emails
                forceDelete: true // But YES to blocking period
            });

        expect(res.statusCode).toBe(200);

        // Verify Deletion
        const listPost = await request(app).get('/api/admin/appointments').set('Authorization', getAuth());
        const existsPost = listPost.body.find(a => a.id === apptId);
        expect(existsPost).toBeUndefined();
    });

    test('Should delete appointment WITH email even if sendEmails is false, if forceDelete is true', async () => {
        // Create Appointment WITH EMAIL
        const booking = await db.createBooking(
            'Email Client',
            '2026-06-02',
            '10:00',
            'Coupe',
            '0600000000',
            adminId,
            'test@example.com'
        );
        const apptId = booking.lastInsertRowid;

        // Create Leave with forceDelete: true, sendEmails: false
        const res = await request(app)
            .post('/api/admin/leaves')
            .set('Authorization', getAuth())
            .send({
                start: '2026-06-02',
                end: '2026-06-02',
                adminId: adminId,
                note: 'Force Leave',
                sendEmails: false, // Don't notify
                forceDelete: true
            });

        expect(res.statusCode).toBe(200);

        // Verify Deletion
        const listPost = await request(app).get('/api/admin/appointments').set('Authorization', getAuth());
        const existsPost = listPost.body.find(a => a.id === apptId);
        expect(existsPost).toBeUndefined();
    });
});
