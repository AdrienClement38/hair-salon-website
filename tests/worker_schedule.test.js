const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

describe('Worker Schedule API', () => {
    let workerId;

    beforeAll(async () => {
        await db.initPromise;
        // Clean up
        await db.query("DELETE FROM admins WHERE username = 'testworker_sched'");
        await db.query("DELETE FROM leaves");

        // Create a worker
        const res = await db.createWorker('testworker_sched', 'test@worker.com', '1234567890', '#000000', [1], 'password');
        workerId = res.lastInsertRowid;

        // Create a future leave for this worker
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 10);
        const start = futureDate.toISOString().split('T')[0];
        futureDate.setDate(futureDate.getDate() + 2);
        const end = futureDate.toISOString().split('T')[0];

        await db.createLeave(start, end, workerId, 'Vacances Test');
    });

    afterAll(async () => {
        if (workerId) {
            await db.deleteAdmin('testworker_sched');
        }
        await db.query("DELETE FROM leaves");
    });

    test('GET /api/workers should include leaves for each worker', async () => {
        const res = await request(app).get('/api/workers');
        expect(res.statusCode).toBe(200);

        const worker = res.body.find(w => w.id === workerId);
        expect(worker).toBeDefined();

        // This is the core requirement: leaves must be present
        expect(worker.leaves).toBeDefined();
        expect(Array.isArray(worker.leaves)).toBe(true);
        expect(worker.leaves.length).toBeGreaterThan(0);

        const leave = worker.leaves[0];
        expect(leave.start_date).toBeDefined();
        expect(leave.end_date).toBeDefined();
        // Ensure sensitive note is NOT present
        expect(leave.note).toBeUndefined();
    });
});
