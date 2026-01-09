
const request = require('supertest');
const app = require('../index');
const db = require('../server/models/database');
const emailService = require('../server/services/emailService');
const bcrypt = require('bcryptjs');

describe('Manual Appointment Cancellation API', () => {
    let adminId;
    const adminUsername = 'manual_cancel_admin';
    let appointmentId;

    beforeAll(async () => {
        // Cleanup potential leftover
        try { await db.deleteAdmin(adminUsername); } catch (e) { }

        // Create Admin for Auth
        const hash = await bcrypt.hash('password', 10);
        const admin = await db.createAdmin(
            adminUsername,
            hash,
            'Manual Cancel Test'
        );
        adminId = admin.lastInsertRowid;
    });

    afterAll(async () => {
        try {
            await db.deleteAdmin(adminUsername);
        } catch (e) { }
    });

    const createTestAppointment = async (email) => {
        const booking = await db.createBooking(
            'Manual Cancel Client',
            '2026-12-25',
            '10:00',
            'Soin',
            '0600000000',
            adminId,
            email // can be null
        );
        return booking.lastInsertRowid;
    };

    beforeEach(() => {
        // Reset Mocks
        jest.spyOn(emailService, 'sendCancellation').mockResolvedValue(true);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        try {
            if (appointmentId) await db.deleteAppointment(appointmentId);
        } catch (e) { }
    });

    test('Should delete appointment WITHOUT sending email if sendEmail=false', async () => {
        appointmentId = await createTestAppointment('test@example.com');
        const auth = 'Basic ' + Buffer.from(`${adminUsername}:password`).toString('base64');

        const res = await request(app)
            .delete(`/api/admin/appointments/${appointmentId}`)
            .set('Authorization', auth)
            .send({ sendEmail: false });

        if (res.statusCode !== 200) {
            console.error('Test Failed Response:', res.body);
        }

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify Email Service NOT called
        expect(emailService.sendCancellation).not.toHaveBeenCalled();

        // Verify Deletion
        const check = await db.getAppointmentById(appointmentId);
        expect(check).toBeUndefined();
    });

    test('Should delete appointment AND send email if sendEmail=true', async () => {
        appointmentId = await createTestAppointment('notify@example.com');
        const auth = 'Basic ' + Buffer.from(`${adminUsername}:password`).toString('base64');

        const res = await request(app)
            .delete(`/api/admin/appointments/${appointmentId}`)
            .set('Authorization', auth)
            .send({ sendEmail: true });

        if (res.statusCode !== 200) {
            console.error('Test Failed Response:', res.body);
        }

        expect(res.statusCode).toBe(200);

        // Verify Email Service CALLED
        expect(emailService.sendCancellation).toHaveBeenCalled();
        const callArgs = emailService.sendCancellation.mock.calls[0][0]; // First argument of first call
        expect(callArgs.email).toBe('notify@example.com');

        // Verify Deletion
        const check = await db.getAppointmentById(appointmentId);
        expect(check).toBeUndefined();
    });

    test('Should NOT fail if sendEmail=true but client has NO email', async () => {
        appointmentId = await createTestAppointment(null); // No email
        const auth = 'Basic ' + Buffer.from(`${adminUsername}:password`).toString('base64');

        const res = await request(app)
            .delete(`/api/admin/appointments/${appointmentId}`)
            .set('Authorization', auth)
            .send({ sendEmail: true }); // Requesting email even if none exists

        expect(res.statusCode).toBe(200);

        // Verify Email Service NOT called (logic prevents it)
        expect(emailService.sendCancellation).not.toHaveBeenCalled();

        // Verify Deletion
        const check = await db.getAppointmentById(appointmentId);
        expect(check).toBeUndefined();
    });
});
