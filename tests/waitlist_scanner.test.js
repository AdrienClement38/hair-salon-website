
const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const waitingListService = require('../server/services/waitingListService');

describe('Waitlist Scanner (Self-Healing)', () => {
    let workerId;
    const testDate = '2026-07-20'; // A Monday

    // Setup: Create Worker
    beforeAll(async () => {
        // Wait for DB init
        await new Promise(r => setTimeout(r, 1000));

        try {
            const suffix = Date.now();
            const phone = `06${String(suffix).slice(-8)}`;
            const w = await db.createWorker(`ScannerWorker${suffix}`, `scan${suffix}@test.com`, phone, '#ffffff', [], 'password123');
            workerId = w.lastInsertRowid;

            // Seed Services
            const services = [
                { name: "Coupe homme (30 min)", duration: 30, price: 25 },
                { name: "Taille barbe (15 min)", duration: 15, price: 15 }
            ];
            await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['services', JSON.stringify(services)]);

            // SET OPENING HOURS WITH PAUSE
            // Monday: 09:30 - 19:00, Pause 12:00 - 14:00
            const hours = {
                1: { start: "09:30", end: "19:00", pause_start: "12:00", pause_end: "14:00" }
            };
            await db.setSetting('opening_hours', hours);

        } catch (e) {
            console.error('Create Worker Failed:', e);
            throw e;
        }
    });

    it('should detect an existing gap and offer it to a pending waiter', async () => {
        // 1. Create a GAP manually (by NOT creating an appointment)
        // We block 09:30-10:00 and 10:30-19:00.
        // Leave 10:00-10:30 free (30 min gap).

        const service30 = "Coupe homme (30 min)"; // 30 min

        // Appt 1: 09:30 - 10:00
        await db.createBooking('Blocker 1', testDate, '09:30', service30, '001', workerId, 'b1@test.com');

        // Gap here: 10:00 - 10:30 (Valid)

        // Appt 2: 10:30 - 11:00
        await db.createBooking('Blocker 2', testDate, '10:30', service30, '003', workerId, 'b3@test.com');

        // 2. Create a WAITING request for 30 minutes
        const waiterEmail = `scanwait${Date.now()}@test.com`;
        await db.addWaitingListRequest('Scan Waiter', waiterEmail, '0699', testDate, service30, workerId);

        // 3. Trigger Scanner
        await waitingListService.scanWaitlist();

        // 4. Verify Offer SENT
        let req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", [waiterEmail]))[0];
        expect(req.status).toBe('OFFER_SENT');
    });

    it('should NOT start a slot during the PAUSE (12:00)', async () => {
        // Case: We have space from 11:30 to 19:00 (since only morning is blocked in previous test setup logic usually persists)
        // Previous test blocked early morning.

        // Let's block 11:00 - 12:00 (2x 30 mins)
        const service30 = "Coupe homme (30 min)";
        await db.createBooking('Blocker pre-lunch', testDate, '11:00', service30, '004', workerId, 'b4@test.com');
        await db.createBooking('Blocker pre-lunch 2', testDate, '11:30', service30, '005', workerId, 'b5@test.com');

        // Now 12:00 is next. But it's PAUSE until 14:00.
        // So free slot should be 14:00.

        // Create request
        const waiterEmail = `pausewait${Date.now()}@test.com`;
        await db.addWaitingListRequest('Pause Waiter', waiterEmail, '0699', testDate, service30, workerId);

        // Scan
        await waitingListService.scanWaitlist();

        // Verify Offer
        let req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", [waiterEmail]))[0];
        expect(req.status).toBe('OFFER_SENT');

        // CHECK THE OFFERED TIME via HOLD Appointment
        // Since the scanner matched and offered, it created a HOLD appointment at the matched time.
        // We want to ensure it matched at 14:00 (after pause), NOT 12:00.

        const hold = (await db.run("SELECT * FROM appointments WHERE date = ? AND email = ? AND status = 'HOLD'", [testDate, waiterEmail]))[0];
        expect(hold).toBeDefined();
        expect(hold.time).toBe('14:00'); // Validates that 12:00 (pause) was skipped

        // Also verify that getDailyGaps now sees it as filled (or next gap starts later)
        const gaps = await db.getDailyGaps(testDate, workerId);
        const gapStarts = gaps.map(g => g.start);
        expect(gapStarts).not.toContain('14:00'); // It's taken by HOLD

        // VERIFY REGRESSION: Ensure OFFER_SENT requests are visible in counts
        // The previous bug hid requests during the offer window.
        // 'req' is already in 'OFFER_SENT' status from the scan above.

        // await db.updateWaitingRequestStatus(req.id, 'OFFER_SENT', 'dummy_token', new Date().toISOString());
        // No need to update, just check counts.
        const countsDuringOffer = await db.getWaitingListCounts(testDate);

        const countForWorker = countsDuringOffer.find(c => c.desired_worker_id === workerId);
        const totalCount = countForWorker ? countForWorker.count : 0;

        // It should be > 0 (because OFFER_SENT must be counted). 
        // We might have multiple requests from previous tests, so we check for existence.
        expect(totalCount).toBeGreaterThan(0);
    });
});
