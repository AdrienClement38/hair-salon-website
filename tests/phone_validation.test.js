
const request = require('supertest');
const app = require('../server/app'); // Adjust path to server app
const db = require('../server/models/database');

describe('Phone Number Validation (Backend)', () => {

    const validPhones = [
        '0612345678',
        '07 12 34 56 78',
        '01 23 45 67 89',
        '04 99 88 77 66',
        '09 55 44 33 22',
        '+33612345678',
        '+33 7 00 00 00 00',
        '0033612345678'
    ];

    const invalidPhones = [
        '061234',      // Too short
        '061234567890', // Too long
        '00 12 34 56 78', // Starts with 00 but not 0033
        '1234567890',  // Does not start with 0 or 33
        'abcdefghij',  // Letters
        '+33(0)612345678' // Complex format often rejected if strict
    ];

    // Reset/Mock DB if needed, but for validation checking 400 vs 200/409/500 is enough.
    // However, if we reach DB, we might get other errors.
    // Creating a booking requires other valid fields.

    const basePayload = {
        name: 'Validation Test User',
        date: '2025-12-25',
        time: '10:00', // Might need to be unique if checking DB success
        service: 'Test Service',
        // adminId: null
    };

    beforeAll(async () => {
        // Maybe ensure DB is clean or setup
        // app might need init
    });

    test.each(validPhones)('Should ACCEPT valid phone: %s', async (phone) => {
        // We might get 409 (slot taken) or 200 (ok), but NOT 400 (Validation Error)
        // We use a random time to avoid collision if possible, or just check error msg.

        const payload = { ...basePayload, phone, time: `10:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}` };

        const res = await request(app)
            .post('/api/book') // Check route name in server/routes/api.js or app.js
            .send(payload);

        expect(res.status).not.toBe(400);
        // If it returns 400, verify it's NOT about phone
        if (res.status === 400) {
            expect(res.body.error).not.toContain('Numéro invalide');
        }
    });

    test.each(invalidPhones)('Should REJECT invalid phone: %s', async (phone) => {
        const payload = { ...basePayload, phone };

        const res = await request(app)
            .post('/api/book')
            .send(payload);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('details');
        const phoneError = res.body.details.find(d => d.path === 'body.phone');
        expect(phoneError).toBeDefined();
        expect(phoneError.message).toContain('Numéro invalide');
    });

});
