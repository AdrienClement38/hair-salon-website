const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Phone Number Refactor (Backend)', () => {

    beforeAll(async () => {
        await db.initPromise;
        // Clean appointments to ensure we check fresh data
        // We can't delete all if concurrent tests run, but supertest runs sequentially in 'runInBand' or we assume isolation.
        // We'll trust the unique time to identify our record.
    });

    test('Should normalize phone number (remove spaces) when saving to database', async () => {
        const payload = {
            name: 'Refactor Test User',
            date: '2025-12-28', // Future date
            time: '10:00',
            service: 'Test Service',
            phone: '06 12 34 56 78', // With spaces
            adminId: null
        };

        // 1. Submit Booking
        const res = await request(app)
            .post('/api/book')
            .send(payload);

        // Expect success (200) because validation allows it (refine checks clean version)
        if (res.status === 409) {
            // Slot already taken, that's fine, we can check if it EXISTS in DB properly or try another time
            // Let's try to verify via DB anyway.
        } else if (res.status !== 200) {
            console.error(res.body);
        }
        expect([200, 409]).toContain(res.status);

        // 2. Check Database directly
        // We need to find the appointment we just tried to make
        const appointments = await db.getAllAppointments();
        const myAppt = appointments.find(a => a.name === payload.name && a.date === payload.date);

        expect(myAppt).toBeDefined();
        // The core requirement: Phone should be stored WITHOUT spaces
        expect(myAppt.phone).toBe('0612345678');
    });

    test('Should normalize phone number with dashes/dots', async () => {
        const payload = {
            name: 'Refactor Test User 2',
            date: '2025-12-28',
            time: '11:00',
            service: 'Test Service',
            phone: '06.12.34.56.78',
            adminId: null
        };

        const res = await request(app).post('/api/book').send(payload);
        expect([200, 409]).toContain(res.status);

        const appointments = await db.getAllAppointments();
        const myAppt = appointments.find(a => a.name === payload.name && a.time === payload.time);

        expect(myAppt).toBeDefined();
        expect(myAppt.phone).toBe('0612345678');
    });

});
