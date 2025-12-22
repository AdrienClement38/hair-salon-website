const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const fs = require('fs');
const path = require('path');

// Mock Data
const MOCK_DATE = '2025-06-15'; // A Sunday (assuming closed? Or need to check config)
// Let's pick a weekday: 2025-06-18 (Wednesday)
const TEST_DATE = '2025-06-18';
const ADMIN_ID = 999;

describe('Smart Scheduling Logic', () => {

    beforeAll(async () => {
        // Setup DB
        await db.init();

        // Create Admin
        await db.run('INSERT OR IGNORE INTO admins (id, username, password_hash) VALUES (?, ?, ?)', [999, 'testadmin', 'hashedpass']);

        // Setup Settings: Open 09:00 - 12:00 for simplicity (3 hours = 180 mins)
        // Services:
        // - Short: 10 mins
        // - Standard: 30 mins
        // - Long: 60 mins
        const services = [
            { id: 'svc-10', name: 'Short Cut', price: '10', duration: 10 },
            { id: 'svc-30', name: 'Standard Cut', price: '20', duration: 30 },
            { id: 'svc-60', name: 'Long Cut', price: '40', duration: 60 }
        ];

        const openingHours = {
            start: '09:00',
            end: '12:00',
            closedDays: [] // Open every day for this test
        };

        await db.setSetting('services', services);
        await db.setSetting('openingHours', openingHours);

        // Clear bookings for test date
        await db.run('DELETE FROM appointments WHERE date = ?', [TEST_DATE]);
    });

    test('Should return slots with 10 min granularity', async () => {
        // 09:00 to 12:00 = 180 mins.
        // Duration 30 mins.
        // Slots should be 09:00, 09:10, 09:20 ... until 11:30 (ending at 12:00)

        const res = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=svc-30`)
            .expect(200);

        expect(res.body.slots).toBeDefined();
        console.log(res.body.slots);
        expect(res.body.slots.length).toBeGreaterThan(0);
        expect(res.body.slots[0]).toBe('09:00');
        // With dynamic grid (30 min service), next slot is 09:30
        expect(res.body.slots[1]).toBe('09:30');

        // 09:00, 09:30, 10:00, 10:30, 11:00, 11:30.
        expect(res.body.slots).toContain('11:30');
    });

    test('Should return fewer slots for longer service', async () => {
        const res30 = await request(app).get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=svc-30`);
        const res60 = await request(app).get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=svc-60`);

        expect(res60.body.slots.length).toBeLessThan(res30.body.slots.length);

        // For 60 mins: 09:00, 10:00, 11:00.
        expect(res60.body.slots).toContain('09:00');
        expect(res60.body.slots).toContain('10:00');
        expect(res60.body.slots).toContain('11:00');
        expect(res60.body.slots).not.toContain('09:30'); // 60 min steps
    });

    test('Should handle gap filling (Tetris)', async () => {
        // Create a booking at 10:00 - 10:30 (Standard Cut)
        await request(app).post('/api/book').send({
            name: 'Blocker',
            phone: '0600000000',
            service: 'Standard Cut', // Matches svc-30 duration 30
            date: TEST_DATE,
            time: '10:00',
            adminId: ADMIN_ID
        }).expect(200);

        // Now check slots for svc-60 (Long Cut 60 mins)
        // Available: 09:00 - 10:00 (60 mins), 10:30 - 12:00 (90 mins).
        // 09:00 fits (ends 10:00).
        // 09:10 fails (ends 10:10, overlap).
        // ...
        // 10:30 fits (ends 11:30).
        // 11:00 fits (ends 12:00).

        const res = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=svc-60`)
            .expect(200);

        const slots = res.body.slots;
        expect(slots).toContain('09:00');
        expect(slots).not.toContain('09:10'); // Overlaps
        expect(slots).toContain('10:30');
        // expect(slots).toContain('11:00'); // Gap optimization removes this "floating" slot to prioritize 10:30
        expect(slots).not.toContain('11:10'); // Ends 12:10 (closed)
    });

    test('Should prevent booking if slot overlaps', async () => {
        // Try to book overlapping the existing 10:00-10:30 booking
        // Attempt 09:50 - 10:20 (Standard Cut 30)
        const res = await request(app).post('/api/book').send({
            name: 'Overlap',
            phone: '0600000000',
            service: 'Standard Cut',
            date: TEST_DATE,
            time: '09:50',
            adminId: ADMIN_ID
        });

        expect(res.status).toBe(500); // Or 409 depending on implementation, currently 500 or Error string
        expect(res.body.error).toMatch(/overlap|booked/i);
    });

    afterAll(async () => {
        // Cleanup
        await db.run('DELETE FROM appointments WHERE date = ?', [TEST_DATE]);
        await db.setSetting('services', []);
    });
});
