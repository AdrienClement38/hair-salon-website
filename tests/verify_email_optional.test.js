const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

jest.mock('../server/services/emailService', () => ({
    sendConfirmation: jest.fn().mockResolvedValue(true),
    sendCancellation: jest.fn().mockResolvedValue(true)
}));

describe('Booking without Email Config', () => {
    let originalEmailConfig;

    beforeAll(async () => {
        // Backup config
        originalEmailConfig = await db.getSetting('email_config');
        // Unset email config
        await db.setSetting('email_config', null);
    });

    afterAll(async () => {
        // Restore config
        if (originalEmailConfig) {
            await db.setSetting('email_config', originalEmailConfig);
        }
    });

    it('should return emailConfigured: false in public settings', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.body.emailConfigured).toBe(false);
        // And shouldn't return the config object itself
        expect(res.body.email_config).toBeUndefined();
    });

    it('should accept a booking with empty email', async () => {
        // Ensure we have a valid test worker/service
        let workers = await db.getAllAdmins();
        if (workers.length === 0) {
            await db.createAdmin('worker_test_email', 'pass', 'Worker');
            workers = await db.getAllAdmins();
        }
        const testWorker = workers[0];

        let services = await db.getSetting('services');
        if (!services || services.length === 0) {
            await db.setSetting('services', [{ name: 'Coupe Homme', duration: 30 }]);
            services = await db.getSetting('services');
        }
        const testService = services[0];

        // Use a fixed future date: tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const date = tomorrow.toISOString().split('T')[0];
        const dayOfWeek = tomorrow.getDay();
        const time = '10:00';

        // Ensure salon is OPEN tomorrow
        const hours = [];
        for (let i = 0; i < 7; i++) {
            hours.push({ isOpen: true, open: '09:00', close: '19:00' });
        }
        await db.setSetting('opening_hours', hours);

        // Cleanup any existing appointment to ensure test passes
        await db.query('DELETE FROM appointments WHERE date = ?', [date]);

        const bookingData = {
            name: 'Test No Email',
            phone: '0612345678',
            email: '', // Empty string
            service: testService ? testService.name : 'Coupe Homme',
            adminId: testWorker ? testWorker.id : null,
            date,
            time
        };

        const res = await request(app)
            .post('/api/book')
            .send(bookingData);



        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

