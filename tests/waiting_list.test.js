/**
 * @jest-environment node
 */
const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const appointmentService = require('../server/services/appointmentService');
const waitingListService = require('../server/services/waitingListService');

// Mock Email Service
const emailService = require('../server/services/emailService');

describe('Waiting List Feature', () => {
    // Increase timeout
    jest.setTimeout(30000);

    let createdWorkerId;
    const testDate = '2026-05-20'; // Future date
    const testTime = '10:00';
    const waitingEmail1 = 'candidate1@example.com';
    const waitingEmail2 = 'candidate2@example.com';

    const bcrypt = require('bcryptjs');
    const workerPass = 'password123';

    beforeAll(async () => {
        // Init DB
        await db.initPromise;

        // Mock Email methods
        emailService.sendWaitlistJoin = jest.fn();
        emailService.sendSlotOffer = jest.fn();
        emailService.sendConfirmation = jest.fn();
        emailService.sendCancellation = jest.fn();

        // Create a worker
        const hash = await bcrypt.hash(workerPass, 10);
        const w = await db.createAdmin('test_worker_wl', hash, 'Worker WL');
        createdWorkerId = w.lastInsertRowid;

        // Ensure clean state
        try { await db.run("DELETE FROM appointments WHERE date = ?", [testDate]); } catch (e) { }
        try { await db.run("DELETE FROM waiting_list_requests"); } catch (e) { }

        // Setup Service
        await db.setSetting('services', [{ id: 's1', name: 'Coupe Test', price: 20, duration: 30 }]);
    });

    afterAll(async () => {
        // Cleanup
        await db.deleteAdmin('test_worker_wl');
        try { await db.run("DELETE FROM appointments WHERE date = ?", [testDate]); } catch (e) { }
        try { await db.run("DELETE FROM waiting_list_requests"); } catch (e) { }
    });

    it('should handle full waitlist lifecycle (Join -> Offer -> Confirm -> Cancel -> Refuse -> Expire)', async () => {

        // --- STEP 0: Join Waiting List ---
        // User 1 Joins
        const res1 = await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Jobar One',
                email: waitingEmail1,
                phone: '0600000001',
                target_date: testDate,
                desired_service_id: 'Coupe Test',
                desired_worker_id: createdWorkerId
            });
        expect(res1.status).toBe(200);

        // User 2 Joins
        const res2 = await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Jobar Two',
                email: waitingEmail2,
                phone: '0600000002',
                target_date: testDate,
                desired_service_id: 'Coupe Test',
                desired_worker_id: createdWorkerId
            });
        expect(res2.status).toBe(200);

        // Verify DB State
        const rows = await db.run("SELECT * FROM waiting_list_requests");
        expect(rows.length).toBe(2);


        // --- STEP 1: Process Cancellation & Offer to Candidate 1 ---
        // 1. Create a Booking (Simulate existing appt)
        const booking = await db.createBooking('Original Client', testDate, testTime, 'Coupe Test', '0600000000', createdWorkerId, 'orig@test.com');
        const apptId = booking.lastInsertRowid;

        // 2. Call DELETE endpoint
        const res = await request(app)
            .delete(`/api/admin/appointments/${apptId}`)
            .auth('test_worker_wl', 'password123')
            .send({ sendEmail: false });

        expect(res.status).toBe(200);

        // 3. Wait for Async Trigger
        await new Promise(r => setTimeout(r, 4000));

        // 4. Verify Candidate 1 has OFFER_SENT
        const req1 = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", [waitingEmail1]))[0];

        expect(req1).toBeDefined();
        expect(req1.status).toBe('OFFER_SENT');
        const token1 = req1.offer_token;
        expect(token1).toBeDefined();

        // 5. Verify HOLD Appointment IS created (Exclusive Reservation)
        // Note: With Smart Gap Detection, the time might shift to the start of the gap (e.g. 09:00 if day is free)
        const holdAppt = (await db.run("SELECT * FROM appointments WHERE date = ? AND email = ? AND status = 'HOLD'", [testDate, waitingEmail1]))[0];
        expect(holdAppt).toBeDefined();
        expect(holdAppt.name).toBe('Jobar One');
        expect(holdAppt.admin_id).toBe(createdWorkerId);


        // --- STEP 2: Confirm Candidate 1 ---
        const resConfirm = await request(app)
            .post('/api/waiting-list/confirm')
            .send({ token: token1 });

        expect(resConfirm.status).toBe(200);

        // Verify Appt is CONFIRMED (Updated from HOLD)
        const finalAppt = (await db.run("SELECT * FROM appointments WHERE id = ?", [holdAppt.id]))[0];
        expect(finalAppt).toBeDefined();
        expect(finalAppt.status).toBe('CONFIRMED');
        expect(finalAppt.email).toBe(waitingEmail1);

        // Verify Request is BOOKED
        const finalReq1 = (await db.run("SELECT * FROM waiting_list_requests WHERE id = ?", [req1.id]))[0];
        expect(finalReq1.status).toBe('BOOKED');


        // --- STEP 3: Refusal Flow (Candidate 2) ---
        // We need to free the slot again.
        await db.deleteAppointment(finalAppt.id);

        // Reset Candidate 2 to WAITING (it should be WAITING, but just ensuring filter picks it)
        // Actually, trigger Match again. Candidate 1 is BOOKED. Candidate 2 is WAITING.
        // processCancellation expects FREED duration.
        await waitingListService.processCancellation(testDate, testTime, 30, createdWorkerId);
        await new Promise(r => setTimeout(r, 4000));

        // Check Req 2 got offer
        const req2 = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", [waitingEmail2]))[0];
        expect(req2).toBeDefined();
        expect(req2.status).toBe('OFFER_SENT');

        // Check HOLD appt created for Candidate 2
        // Note: Time might shift due to gap merging.
        const holdAppt2 = (await db.run("SELECT * FROM appointments WHERE date = ? AND email = ? AND status = 'HOLD'", [testDate, waitingEmail2]))[0];
        expect(holdAppt2).toBeDefined();
        expect(holdAppt2.email).toBe(waitingEmail2);

        // Req 2 Refuses
        const resRefuse = await request(app)
            .post('/api/waiting-list/refuse')
            .send({ token: req2.offer_token });
        expect(resRefuse.status).toBe(200);

        await new Promise(r => setTimeout(r, 4000));

        // Verify Req 2 is REFUSED
        const finalReq2 = (await db.run("SELECT * FROM waiting_list_requests WHERE id = ?", [req2.id]))[0];
        expect(finalReq2.status).toBe('REFUSED');

        // Verify HOLD appt deleted
        const holdAfterRefuse = (await db.run("SELECT * FROM appointments WHERE id = ?", [holdAppt2.id]))[0];
        expect(holdAfterRefuse).toBeUndefined();


        // --- STEP 4: Expiration Flow (Candidate 3) ---
        // Create Req 3
        await db.addWaitingListRequest('Jobar Three', 'c3@test.com', '063', testDate, 'Coupe Test', createdWorkerId);

        // Trigger Match (Req 1 Booked, Req 2 Refused, Req 3 Waiting)
        // Note: Logic should pick Req 3
        await waitingListService.processCancellation(testDate, testTime, 30, createdWorkerId);
        await new Promise(r => setTimeout(r, 4000));

        const req3 = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", ['c3@test.com']))[0];
        expect(req3).toBeDefined();
        expect(req3.status).toBe('OFFER_SENT');

        // Manually expire
        await db.run("UPDATE waiting_list_requests SET offer_expires_at = ? WHERE client_email = ?", ['2020-01-01 00:00:00', 'c3@test.com']);

        // Run Timeout Handler
        await waitingListService.handleTimeouts();

        // Verify Expired
        const finalReq3 = (await db.run("SELECT * FROM waiting_list_requests WHERE client_email = ?", ['c3@test.com']))[0];
        expect(finalReq3.status).toBe('EXPIRED');

        // Verify HOLD Appt Deleted
        const holdAppt3 = (await db.run("SELECT * FROM appointments WHERE date = ? AND time = ? AND status = 'HOLD'", [testDate, testTime]))[0];
        // Note: We didn't capture holdAppt3 before. But we can check by email.
        const holdAfterExpire = (await db.run("SELECT * FROM appointments WHERE email = ? AND status = 'HOLD'", ['c3@test.com']))[0];
        expect(holdAfterExpire).toBeUndefined();

    });

});
