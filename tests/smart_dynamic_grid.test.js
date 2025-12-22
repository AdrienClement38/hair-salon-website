const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

const TEST_DATE = '2026-02-01'; // Far future
const ADMIN_ID = 998; // Dedicated ID for this test

describe('Smart Dynamic Grid (Anchor-Based)', () => {

    beforeAll(async () => {
        await db.init();

        // 1. Setup Admin
        await db.run('INSERT OR IGNORE INTO admins (id, username, password_hash) VALUES (?, ?, ?)', [ADMIN_ID, 'smarttester', 'hash']);

        // 2. Setup Services
        const services = [
            { id: 'svc-20', name: 'Cut 20', price: '20', duration: 20 },
            { id: 'svc-45', name: 'Color 45', price: '45', duration: 45 }
        ];
        await db.setSetting('services', services);

        // 3. Setup Opening Hours: 09:00 - 12:00
        await db.setSetting('openingHours', { start: '09:00', end: '12:00', closedDays: [] });
    });

    beforeEach(async () => {
        await db.run('DELETE FROM appointments WHERE date = ?', [TEST_DATE]);
    });

    test('Should generate slots based on Opening Time Anchor', async () => {
        // Gap: 09:00 - 12:00 (180 mins)
        // Service: 45 mins.
        // Expected: 09:00, 09:45, 10:30, 11:15. (12:00 would end at 12:45 -> invalid)

        const res = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=svc-45`)
            .expect(200);

        const slots = res.body.slots;
        expect(slots).toContain('09:00');
        expect(slots).toContain('09:45');
        expect(slots).toContain('10:30');
        expect(slots).toContain('11:15');
        expect(slots).not.toContain('09:15'); // Should NOT offer random grid times
    });

    test('Should generate slots based on Booking End Time Anchor', async () => {
        // Setup: Booking 09:00 - 09:20 (Cut 20)
        await request(app).post('/api/book').send({
            name: 'Client A', phone: '0600000000', service: 'Cut 20',
            date: TEST_DATE, time: '09:00', adminId: ADMIN_ID
        });

        // Gap: 09:20 - 12:00.
        // Service: 20 mins.
        // Anchors: 
        // 1. Open 09:00 -> 09:00 (Conflict), 09:20 (Valid), 09:40, 10:00...
        // 2. Booking End 09:20 -> 09:20 (Valid), 09:40...

        const res = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=svc-20`)
            .expect(200);

        const slots = res.body.slots;
        // The key check: verify 09:20 is offered.
        expect(slots).toContain('09:20');
        expect(slots).toContain('09:40');
    });

    test('Should handle odd ending times correctly', async () => {
        // Setup: Booking 10:00 - 10:45 (Color 45) in middle of day.
        // Gap before: 09:00 - 10:00 (60m).
        // Gap after: 10:45 - 12:00 (75m).

        await request(app).post('/api/book').send({
            name: 'Client B', phone: '0600000000', service: 'Color 45',
            date: TEST_DATE, time: '10:00', adminId: ADMIN_ID
        }).expect(200);

        // Request: 20 min service.
        // Before Gap (Anchor 09:00): 09:00, 09:20, 09:40. (10:00 is booked).
        // After Gap (Anchor 10:45): 10:45, 11:05, 11:25, 11:45. (12:05 invalid).

        const res = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=svc-20`)
            .expect(200);

        const slots = res.body.slots;
        expect(slots).toContain('09:20');
        expect(slots).toContain('09:40');
        expect(slots).toContain('10:45'); // Crucial: Starts exactly when previous ends
        expect(slots).toContain('11:05'); // 10:45 + 20
    });

    afterAll(async () => {
        await db.run('DELETE FROM appointments WHERE date = ?', [TEST_DATE]);
    });
});
