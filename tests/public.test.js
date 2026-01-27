const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Public Interface Tests', () => {

    beforeAll(async () => {
        await db.initPromise;
    });

    // US-1.1: Discovery - Home Content
    test('US-1.1: Should return home content', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('home_content');
        // title is optional now that logo can replace it
        // expect(res.body.home_content).toHaveProperty('title');
    });

    // US-1.2: Discovery - Services
    test('US-1.2: Should return list of services', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.services)).toBe(true);
    });

    // US-1.3: Discovery - Opening Hours
    test('US-1.3: Should return opening hours', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.openingHours)).toBe(true);
    });

    // US-1.4: Booking - Slots
    test('US-1.4: Should return slots for a given date', async () => {
        const date = '2099-01-01'; // Future date
        const res = await request(app).get(`/api/slots?date=${date}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('slots');
        expect(Array.isArray(res.body.slots)).toBe(true);
        expect(res.body).toHaveProperty('reason');
    });

    // US-1.6: Booking - Make Appointment
    test('US-1.6: Should create a booking', async () => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 10);
        const validDate = targetDate.toISOString().split('T')[0];

        // Cleanup
        await db.query('DELETE FROM appointments WHERE date = ?', [validDate]);

        const bookingData = {
            name: 'Test Client',
            phone: '0612345678',
            service: 'Coupe Homme',
            date: validDate,
            time: '10:00'
        };

        const res = await request(app).post('/api/book').send(bookingData);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    // US-1.5: Booking - Prevent Duplicate
    test('US-1.5: Should prevent booking taken slot', async () => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 10);
        const validDate = targetDate.toISOString().split('T')[0];

        const bookingData = {
            name: 'Another Client',
            phone: '0687654321',
            service: 'Barbe',
            date: validDate,
            time: '10:00' // Same time as above
        };

        const res = await request(app).post('/api/book').send(bookingData);
        expect(res.statusCode).toBe(409); // Controller returns 409 on conflict
        expect(res.body).toHaveProperty('error');
    });

});
