/**
 * @jest-environment node
 */
const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Waiting List Duplicate Feature', () => {
    jest.setTimeout(30000);

    const testDate = '2026-06-20';
    const otherDate = '2026-06-21';
    const email = 'duplicate_test@example.com';
    let workerId;

    beforeAll(async () => {
        await db.initPromise;
        // Mock Email
        const emailService = require('../server/services/emailService');
        emailService.sendWaitlistJoin = jest.fn();

        // Create worker
        const w = await db.createAdmin('dup_worker', 'hash', 'Duplicate Worker');
        if (w.lastInsertRowid) workerId = w.lastInsertRowid;
        else workerId = w.id; // pg vs sqlite

        // Cleanup
        try { await db.run("DELETE FROM waiting_list_requests WHERE client_email = ?", [email]); } catch (e) { }
    });

    afterAll(async () => {
        await db.deleteAdmin('dup_worker');
        try { await db.run("DELETE FROM waiting_list_requests WHERE client_email = ?", [email]); } catch (e) { }
    });

    it('should block duplicate requests for the same day', async () => {
        // 1. Join for Day 1
        const res1 = await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Dup Tester',
                email: email,
                phone: '0699999999',
                target_date: testDate,
                desired_service_id: 'Coupe Test',
                desired_worker_id: workerId
            });
        expect(res1.status).toBe(200);

        // 2. Join AGAIN for Day 1 -> Should Fail
        const res2 = await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Dup Tester',
                email: email,
                phone: '0699999999',
                target_date: testDate,
                desired_service_id: 'Coupe Test',
                desired_worker_id: workerId
            });

        // Expect 409 Conflict
        expect(res2.status).toBe(409);
        // Normalized error check
        const errText = res2.body.error || res2.text;
        expect(errText).toMatch(/déjà sur la liste/i);
    });

    it('should allow joining for a DIFFERENT day', async () => {
        const res3 = await request(app)
            .post('/api/waiting-list')
            .send({
                name: 'Dup Tester',
                email: email,
                phone: '0699999999',
                target_date: otherDate,
                desired_service_id: 'Coupe Test',
                desired_worker_id: workerId
            });
        expect(res3.status).toBe(200);
    });

});
