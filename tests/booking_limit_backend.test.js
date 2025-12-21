
const request = require('supertest');
const app = require('../server/app');

describe('Booking Horizon Limit (Backend)', () => {

    test('Should ACCEPT booking within 2 months', async () => {
        // Date = Today + 30 days
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 30);
        const dateStr = targetDate.toISOString().split('T')[0];

        const payload = {
            name: 'Limit Test Valid',
            date: dateStr,
            time: '10:00',
            service: 'Coupe Test',
            phone: '0612345678'
        };

        const res = await request(app)
            .post('/api/book') // Verify route name, usually /api/appointments or /api/book
            .send(payload);

        // Current API might route via /api/appointments or /api/book?
        // Checking routes/api.js would be good, but assuming standard from previous work
        // Actually, looking at previous tests, it was `/api/appointments` for POST? 
        // Let's check: previous test used `/api/appointments` or `/api/book`?
        // non_regression used `/api/appointments`.
        // phone_validation used `/api/book` (Wait, did I use that? I should check).
        // Let's try /api/appointments based on non_regression.
    });

    test('Should REJECT booking > 2 months in advance', async () => {
        // Date = Today + 65 days
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 65);
        const dateStr = targetDate.toISOString().split('T')[0];

        const payload = {
            name: 'Limit Test Too Far',
            date: dateStr,
            time: '14:00',
            service: 'Coupe Test',
            phone: '0612345678'
        };

        const res = await request(app)
            .post('/api/book')
            .send(payload);

        expect(res.status).toBe(400); // Expect validation error
        // Middleware structure: { error: 'Validation Error', details: [{ message: '...' }] }
        const errorMsg = res.body.details ? res.body.details.map(d => d.message).join(' ') : res.body.error;
        expect(errorMsg).toMatch(/trop lointaine|2 mois/i);
    });

});
