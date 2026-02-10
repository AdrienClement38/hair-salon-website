const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

const ADMIN_ID = 888;

describe('Past Slots Filtering', () => {

    beforeAll(async () => {
        await db.init();
        // Create Admin
        await db.run('INSERT OR IGNORE INTO admins (id, username, password_hash) VALUES (?, ?, ?)', [ADMIN_ID, 'pasttest', 'hash']);

        // Setup Services
        const services = [
            { id: 'svc-30', name: 'Standard Cut', price: '20', duration: 30 },
        ];
        await db.setSetting('services', services);

        // Setup Open Hours (09:00 - 18:00)
        const schedule = [];
        for (let i = 0; i < 7; i++) {
            schedule.push({ isOpen: true, open: '09:00', close: '18:00' });
        }
        await db.setSetting('opening_hours', schedule);
    });

    test('Should filter out past slots for today', async () => {
        // Set "Now" to 14:00 on 2026-02-05
        const mockNow = new Date('2026-02-05T14:00:00');
        jest.useFakeTimers().setSystemTime(mockNow);

        const TODAY = '2026-02-05';

        const res = await request(app)
            .get(`/api/slots?date=${TODAY}&adminId=${ADMIN_ID}&serviceId=svc-30`)
            .expect(200);

        const slots = res.body.slots;
        console.log('Slots returned:', slots);

        // 09:00 -> 13:30 should be missing
        expect(slots).not.toContain('09:00');
        expect(slots).not.toContain('10:00');
        expect(slots).not.toContain('13:30');
        expect(slots).not.toContain('14:00'); // 14:00 is exact match, logic was <= currentMinutes (14:00 is current)

        // 14:30 should be present (if available)
        // 14:00 is 840 mins. Service 30 mins -> ends 14:30.
        // If "now" is 14:00, can I book 14:00?
        // My logic: if t <= current, exclude. 14:00 <= 14:00. Exclude.
        // So first available should be next valid slot.
        // Next slot logic generates 14:00, 14:30...
        // 14:00 filtered. 14:30 should be there.

        expect(slots).toContain('14:30');
        expect(slots).toContain('15:00');
    });

    test('Should NOT filter past slots for tomorrow', async () => {
        const TOMORROW = '2026-02-06';
        // Now is still 14:00 today (2026-02-05)

        const res = await request(app)
            .get(`/api/slots?date=${TOMORROW}&adminId=${ADMIN_ID}&serviceId=svc-30`)
            .expect(200);

        const slots = res.body.slots;
        expect(slots).toContain('09:00'); // Morning slots should be available for tomorrow
    });

    afterAll(async () => {
        jest.useRealTimers();
        // Cleanup?
    });
});
