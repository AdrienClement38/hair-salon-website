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
        // Ensure we have a valid test worker/service/date
        const workers = await db.getAllAdmins();
        const testWorker = workers[0];
        const services = await db.getSetting('services');
        const testService = services[0];

        // Find a slot? Or just try to book (mocking slots check or using a future date)
        const date = '2025-06-01'; // Future date
        const time = '10:00';

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

        if (res.status !== 200) {
            console.log('Error:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
