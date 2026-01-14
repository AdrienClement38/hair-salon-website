
const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const waitingListService = require('../server/services/waitingListService');

describe.skip('Waitlist Smart Gap Detection', () => {
    let workerId;
    const testDate = '2026-06-15';

    // Setup: Create Worker
    // Setup: Create Worker
    beforeAll(async () => {
        // Wait for DB init
        await new Promise(r => setTimeout(r, 1000));
        console.log('Test setup starting...');

        // Create worker
        try {
            const w = await db.createWorker('GapWorker', 'gap@test.com', '0600000099', '#ffffff', [], 'password123');
            workerId = w.lastInsertRowid;
        } catch (e) {
            console.error('Create Worker Failed:', e);
            throw e;
        }

        // Ensure default opening hours (usually defaults are fine, or we mock settings)
        // We rely on defaults 9-19 in code if not set.

        // Seed Services for Test
        const services = [
            { name: "Taille barbe à blanc (15 min)", duration: 15, price: 10, icon: 'razor' },
            { name: "Coupe homme (30 min)", duration: 30, price: 20, icon: 'cut' }
        ];
        // We use JSON stringify because database stores it as string/json
        await db.setSetting('services', services);
    });

    afterAll(async () => {
        // Cleanup not strictly feasible without direct DB access or heavy helpers, 
        // but we use unique worker/date to avoid collisions.
    });

    it('should detect a 30min gap when deleting two 15min slots', async () => {
        // 1. Create two 15 min appointments at 10:30 and 10:45
        // Assuming "Taille barbe à blanc (15 min)" exists and duration is 15.
        // If not, we might need to mock or ensure service exists.
        // Let's create appointments manually with duration-check in mind.
        // Service name must match one in `getServiceDuration`.

        // Let's just create 'Appointment 1' and 'Appointment 2' and ensure our mock services 
        // or real services have them.
        // Actually `processCancellation` reads services from DB.

        // Let's seed a service "GapService15" if possible?
        // Or assume "Taille barbe à blanc (15 min)" exists (standard in this app).
        const service15 = "Taille barbe à blanc (15 min)"; // 15 min
        const service30 = "Coupe homme (30 min)"; // 30 min

        const service90 = "Coloration (90 min)"; // Dummy long service or just use string if unvalidated?
        // Actually createBooking checks service? No, it just stores string usually unless validation enabled.
        // Let's use known service "Coupe homme (30 min)" repeated or just simple.

        // BLOCK EARLY MORNING explicitly to prevent match at 09:00/09:30
        // Blocker: 09:00 - 10:30
        const blocker = await db.createBooking('Blocker', testDate, '09:00', 'Coupe homme (30 min)', '000', workerId, 'blocker@test.com');
        // We need to ensure this blocker covers 09:00-10:30. 
        // Coupe homme is 30 mins. It only covers 09:00-09:30.
        // We need more blockers.
        await db.createBooking('Blocker 2', testDate, '09:30', 'Coupe homme (30 min)', '001', workerId, 'blocker2@test.com');
        await db.createBooking('Blocker 3', testDate, '10:00', 'Coupe homme (30 min)', '002', workerId, 'blocker3@test.com');

        // Create Appt 1: 10:30 - 10:45
        const booking1 = await db.createBooking('Client 1', testDate, '10:30', service15, '061', workerId, 'c1@test.com');

        // Create Appt 2: 10:45 - 11:00
        const booking2 = await db.createBooking('Client 2', testDate, '10:45', service15, '062', workerId, 'c2@test.com');

        // Create Waitlist Request for 30 mins
        await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Waiter Big',
                email: 'waiter@gap.com',
                phone: '0699999999',
                target_date: testDate,
                desired_service_id: service30, // Needs 30 min
                desired_worker_id: workerId
            });

        // 2. Delete First Slot (10:30)
        // This frees 10:30-10:45 cleanly. Gap is 15min.
        // Waiter needs 30min. Should NOT match.

        // Mock `matchAndOffer` to spy? No, check DB side effects.
        // DB side effect = OFFER_SENT status or HOLD appt.

        await waitingListService.processCancellation(testDate, '10:30', 15, workerId);

        // Verify NO offer sent
        let req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = 'waiter@gap.com'"))[0];
        expect(req.status).toBe('WAITING');

        // 3. Delete Second Slot (10:45)
        // This frees 10:45-11:00.
        // But logic should see 10:30 is NOW free too (from step 2).
        // Merged Gap: 10:30 - 11:00 (30 mins).
        // Should match Waiter.

        await waitingListService.processCancellation(testDate, '10:45', 15, workerId); // Wait a bit for async? processCancellation is async.

        // Verify Offer SENT
        req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = 'waiter@gap.com'"))[0];
        expect(req.status).toBe('OFFER_SENT');

        // Verify HOLD appt created at 10:30 (Start of GAP)
        const hold = (await db.run("SELECT * FROM appointments WHERE date = ? AND time = ? AND status = 'HOLD'", [testDate, '10:30']))[0];
        expect(hold).toBeDefined();
        expect(hold.email).toBe('waiter@gap.com');
    });
});
