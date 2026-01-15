
const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const waitingListService = require('../server/services/waitingListService');

describe('Waitlist Smart Gap Detection', () => {
    let workerId;
    const testDate = '2026-06-15';

    // Setup: Create Worker and Seed Data
    beforeAll(async () => {
        await new Promise(r => setTimeout(r, 1000));

        // 1. Create Worker
        const w = await db.createWorker('GapWorker', 'gap@test.com', '0600000099', '#ffffff', [], 'password123');
        workerId = w.lastInsertRowid;

        // 2. Set Opening Hours with PAUSE
        // 09:30 - 19:00, Pause 12:00 - 14:00
        const hours = {
            1: { start: "09:30", end: "19:00", pause_start: "12:00", pause_end: "14:00" } // Monday
        };
        // Ensure testDate is a Monday (2026-06-15 is Monday)
        await db.setSetting('opening_hours', JSON.stringify(hours));

        // 3. Seed Services
        const services = [
            { name: "Taille barbe à blanc (15 min)", duration: 15, price: 10, icon: 'razor' },
            { name: "Coupe homme (30 min)", duration: 30, price: 20, icon: 'cut' },
            { name: "Long Service (60 min)", duration: 60, price: 50, icon: 'cut' }
        ];
        await db.setSetting('services', services);
    });

    afterAll(async () => {
        // Cleanup if needed
    });

    it('should detect a 30min gap when deleting two 15min slots', async () => {
        const service15 = "Taille barbe à blanc (15 min)"; // 15 min
        const service30 = "Coupe homme (30 min)"; // 30 min

        // Block Early Morning (09:30 - 10:30)
        await db.createBooking('Blocker', testDate, '09:30', service30, '000', workerId, 'blocker@test.com');
        await db.createBooking('Blocker', testDate, '10:00', service30, '001', workerId, 'blocker@test.com');

        // Create Appt 1: 10:30 - 10:45
        await db.createBooking('Client 1', testDate, '10:30', service15, '061', workerId, 'c1@test.com');
        // Create Appt 2: 10:45 - 11:00
        await db.createBooking('Client 2', testDate, '10:45', service15, '062', workerId, 'c2@test.com');

        // Create Waitlist Request for 30 mins
        await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Waiter Big',
                email: 'waiter@gap.com',
                phone: '0699999999',
                target_date: testDate,
                desired_service_id: service30,
                desired_worker_id: workerId
            });

        // Delete First Slot (10:30) - Gap 15min (No match)
        // Note: processCancellation is usually called AFTER deletion.
        // We must perform the deletion DB side to verify "merging" in step 2.

        await db.run("DELETE FROM appointments WHERE date = ? AND time = ?", [testDate, '10:30']);
        await waitingListService.processCancellation(testDate, '10:30', 15, workerId);

        let req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = 'waiter@gap.com'"))[0];
        expect(req.status).toBe('WAITING');

        // Delete Second Slot (10:45) - Merged Gap 30min (Match!)
        // Now 10:30 is already gone (deleted above).
        await db.run("DELETE FROM appointments WHERE date = ? AND time = ?", [testDate, '10:45']);
        await waitingListService.processCancellation(testDate, '10:45', 15, workerId);

        // Verify Match
        req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = 'waiter@gap.com'"))[0];
        expect(req.status).toBe('OFFER_SENT');
    });

    it('should NOT offer a slot that overlaps with the PAUSE (12:00-14:00)', async () => {
        // Case: Service is 60 mins.
        // Available slot: 11:30 - 12:30 (1 hour free before next appt starts at 12:30? No, pause starts at 12:00)
        // Correct logic: Gap is 11:30 - 12:00 (30 mins).
        // Waiter wants 60 mins. Should NOT match.

        const service60 = "Long Service (60 min)";
        const service30 = "Coupe homme (30 min)";

        // Create Waiter for 60 min
        await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Waiter Long',
                email: 'waiter@long.com',
                phone: '0699999999',
                target_date: testDate,
                desired_service_id: service60,
                desired_worker_id: workerId
            });

        // Create booking at 11:00 - 11:30 (30 min)
        await db.createBooking('Client A', testDate, '11:00', service30, '080', workerId, 'a@test.com');

        // Pause starts at 12:00.
        // Create booking at 12:00? No, that's pause.
        // Create booking at 11:30 is what we want to delete to free up space?
        // Let's say we have a booking at 11:30 - 12:00.
        await db.createBooking('Client B', testDate, '11:30', service30, '081', workerId, 'b@test.com');

        // Delete 11:30 appt.
        // Freed: 11:30 - 12:00 (30 mins).
        // The gap merges?
        // Previous appt ends 11:30.
        // Next event is PAUSE at 12:00.
        // Available window: 11:30 - 12:00 (30 mins).
        // Waiter needs 60 mins.
        // Should NOT trigger.

        // If pause was ignored, it might see 11:30 - 19:00 (if no other appts).
        // But with pause injected, it hits the wall at 12:00.

        await waitingListService.processCancellation(testDate, '11:30', 30, workerId);

        let req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = 'waiter@long.com'"))[0];
        expect(req.status).toBe('WAITING');
    });
});
