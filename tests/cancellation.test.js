const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const emailService = require('../server/services/emailService');

// Mock Email Service
jest.mock('../server/services/emailService');
// Mock Auth Middleware
jest.mock('../server/middleware/auth', () => (req, res, next) => next());

describe('Cancellation Emails', () => {
    let adminId;
    const testUsername = 'cancel_test_user';

    beforeAll(async () => {
        await db.initPromise;
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('password', 10);
        const res = await db.createAdmin(testUsername, hash, 'Cancel User', []);
        adminId = res.lastInsertRowid;

        // Mock DB settings for email
        await db.setSetting('email_config', { user: 'test@salon.com', pass: 'secret' });
    });

    afterAll(async () => {
        await db.run('DELETE FROM admins WHERE id = ?', [adminId]);
        await db.run('DELETE FROM appointments WHERE name = ?', ['Test Client']);
        await db.run('DELETE FROM leaves WHERE note = ?', ['Test Leave']);
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        // Clean appointments
        await db.run('DELETE FROM appointments WHERE name = ?', ['Test Client']);
    });

    it('should send cancellation email when creating a conflicting leave with sendEmails=true', async () => {
        // 1. Create Appointment
        const today = new Date().toISOString().split('T')[0];
        // name, date, time, service, phone, adminId, email
        await db.createBooking('Test Client', today, '10:00', 'Coupe', null, adminId, 'client@example.com');

        // DEBUG: Verify it exists
        // DEBUG: Verify it exists
        const appts = await db.getAllAppointments(adminId);
        const myAppt = appts.find(a => a.name === 'Test Client');
        console.log('DEBUG TEST: Created Appt:', myAppt);
        expect(myAppt).toBeDefined();
        expect(myAppt.email).toBe('client@example.com');

        // 2. Create Conflicting Leave
        const res = await request(app)
            .post('/api/admin/leaves')
            .send({
                start: today,
                end: today,
                adminId: adminId,
                note: 'Test Leave',
                sendEmails: true // Feature Flag
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // 3. Verify Email Sent
        expect(emailService.sendCancellation).toHaveBeenCalledTimes(1);
        expect(emailService.sendCancellation).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'client@example.com',
                name: 'Test Client'
            }),
            expect.objectContaining({
                reason: 'Test Leave'
            })
        );
    });

    it('should NOT send email if sendEmails=false', async () => {
        // 1. Create Appointment
        const today = new Date().toISOString().split('T')[0];
        await db.createBooking('Test Client', today, '12:00', 'Coupe', null, adminId, 'client@example.com');

        // 2. Create Conflicting Leave
        const res = await request(app)
            .post('/api/admin/leaves')
            .send({
                start: today,
                end: today,
                adminId: adminId,
                note: 'Test Leave No Email',
                sendEmails: false
            });

        expect(res.statusCode).toBe(200);
        expect(emailService.sendCancellation).not.toHaveBeenCalled();
    });
});
