const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

const TEST_DATE = '2026-04-20'; // A Monday
const ADMIN_ID = 3;

describe('Admin Slots Refinement (excludeId & Encoding)', () => {

    beforeAll(async () => {
        await db.init();

        // Ensure Admin 3 exists
        await db.run('INSERT OR IGNORE INTO admins (id, username, password_hash) VALUES (?, ?, ?)', [3, 'worker3', 'hashedpass']);

        const services = [
            { id: 'svc-15', name: 'Taille barbe à blanc', price: '10', duration: 15 },
            { id: 'svc-30', name: 'Coupe homme', price: '12', duration: 30 }
        ];

        const schedule = [];
        for (let i = 0; i < 7; i++) {
            schedule.push({
                isOpen: true,
                open: '09:00',
                close: '18:00'
            });
        }

        await db.setSetting('services', services);
        await db.setSetting('opening_hours', schedule);

        // Clear bookings for test date
        await db.run('DELETE FROM appointments WHERE date = ?', [TEST_DATE]);
    });

    test('Should handle special characters in service name', async () => {
        // "Taille barbe à blanc" has an "à"
        const serviceName = 'Taille barbe à blanc';
        const res = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=${encodeURIComponent(serviceName)}`)
            .expect(200);

        expect(res.body.slots).toBeDefined();
        // Should find 15 min slots because the service duration is 15.
        // 09:00, 09:15, 09:30...
        expect(res.body.slots).toContain('09:15');
    });

    test('Should exclude appointment from blocking its own slot when excludeId is passed', async () => {
        const time = '15:15';
        const serviceName = 'Taille barbe à blanc';

        // 1. Book the slot
        const bookingRes = await request(app).post('/api/book').send({
            name: 'Test Client',
            phone: '0600000000',
            service: serviceName,
            date: TEST_DATE,
            time: time,
            adminId: ADMIN_ID
        }).expect(200);

        const appointmentId = bookingRes.body.id;

        // 2. Fetch slots WITHOUT excludeId
        const resNormal = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=${encodeURIComponent(serviceName)}`)
            .expect(200);

        expect(resNormal.body.slots).not.toContain(time);

        // 3. Fetch slots WITH excludeId
        const resExcluded = await request(app)
            .get(`/api/slots?date=${TEST_DATE}&adminId=${ADMIN_ID}&serviceId=${encodeURIComponent(serviceName)}&excludeId=${appointmentId}`)
            .expect(200);

        // NOW the slot should be available!
        expect(resExcluded.body.slots).toContain(time);

        // And the adjacent slot 15:00 should also be available (because it's only 15 mins now)
        expect(resExcluded.body.slots).toContain('15:00');
    });

    afterAll(async () => {
        await db.run('DELETE FROM appointments WHERE date = ?', [TEST_DATE]);
    });
});
