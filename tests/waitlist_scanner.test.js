
const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const waitingListService = require('../server/services/waitingListService');

describe('Waitlist Scanner (Self-Healing)', () => {
    let workerId;
    const testDate = '2026-07-20';

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

        } catch (e) {
            console.error('Create Worker Failed:', e);
            throw e;
        }
    });

    it('should detect an existing gap and offer it to a pending waiter', async () => {
        // 1. Create a GAP manually (by NOT creating an appointment)
        // We know default day is 9-19.
        // Let's block 09:00-10:00 and 10:30-19:00.
        // Leave 10:00-10:30 free (30 min gap).

        const service30 = "Coupe homme (30 min)"; // 30 min

        // Appt 1: 09:00 - 10:00 (assume 2x30min or custom service)
        // We assume "Coupe homme" is 30m. Let's create two 30m appts.
        await db.createBooking('Blocker 1', testDate, '09:00', service30, '001', workerId, 'b1@test.com');
        await db.createBooking('Blocker 2', testDate, '09:30', service30, '002', workerId, 'b2@test.com');

        // Gap here: 10:00 - 10:30

        // Appt 3: 10:30 - 11:00
        await db.createBooking('Blocker 3', testDate, '10:30', service30, '003', workerId, 'b3@test.com');

        // 2. Create a WAITING request for 30 minutes
        const waiterEmail = `scanwait${Date.now()}@test.com`;
        await db.addWaitingListRequest('Scan Waiter', waiterEmail, '0699', testDate, service30, workerId);

        // Verify it is WAITING
        let req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", [waiterEmail]))[0];
        expect(req.status).toBe('WAITING');

        // 3. Trigger Scanner
        await waitingListService.scanWaitlist();

        // 4. Verify Offer SENT
        req = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", [waiterEmail]))[0];
        expect(req.status).toBe('OFFER_SENT');

        // 5. Verify HOLD appt created at 10:00
        const hold = (await db.run("SELECT * FROM appointments WHERE date = ? AND email = ? AND status = 'HOLD'", [testDate, waiterEmail]))[0];
        expect(hold).toBeDefined();
    });
});
