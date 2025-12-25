const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Worker Weekly Days Off', () => {
    let adminToken;
    let workerId;

    beforeAll(async () => {
        await db.initPromise;
        // Clean cleanup
        await db.run("DELETE FROM leaves");
        // Also clean admins to avoid username conflicts if not memory
        await db.run("DELETE FROM admins WHERE username != 'test_scheduler' AND username != 'admin'");
        // Clean test_scheduler specifically just in case
        await db.run("DELETE FROM admins WHERE username = 'test_scheduler'");

        // Create Admin
        await db.createAdmin('test_scheduler', await bcrypt.hash('password123', 10), 'Scheduler');

        // Construct Basic Auth Header manually
        const credentials = Buffer.from('test_scheduler:password123').toString('base64');
        adminToken = `Basic ${credentials}`;
    });

    afterAll(async () => {
        if (workerId) {
            // Cleanup passed to function if needed, but in-memory cleans itself on exit
        }
    });

    test('Should create a worker with days off (Monday=1)', async () => {
        const payload = {
            username: 'mondays_off',
            password: 'password123',
            displayName: 'No Monday',
            daysOff: [1] // Monday
        };

        const res = await request(app)
            .post('/api/admin/workers')
            .set('Authorization', adminToken) // Use token directly (Basic ...)
            .send(payload);

        if (res.status !== 200) console.error("Create Worker Error:", res.body);
        expect(res.status).toBe(200);

        // Fetch to verify ID
        const list = await request(app).get('/api/admin/workers').set('Authorization', adminToken);
        const worker = list.body.find(w => w.username === 'mondays_off');
        expect(worker).toBeDefined();
        workerId = worker.id;

        // Verify days_off (via DB query or list response)
        // Checking API response property
        // listPublicWorkers exposes daysOff? No, listWorkers (admin) does.
        expect(worker.daysOff).toEqual([1]);
    });

    test('Should NOT have slots on Monday', async () => {
        // Find next Monday
        const d = new Date();
        d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
        if (d.getDay() !== 1) d.setDate(d.getDate() + 7); // Safety ensure future

        const dateStr = d.toISOString().split('T')[0];

        const res = await request(app)
            .get(`/api/slots?date=${dateStr}&adminId=${workerId}`)
            .expect(200);

        // Expect empty slots or reason
        expect(res.body.slots).toEqual([]);
        expect(res.body.reason).toBe('worker_off_day');
    });

    test('Should HAVE slots on Tuesday', async () => {
        // Find next Tuesday
        const d = new Date();
        d.setDate(d.getDate() + ((2 + 7 - d.getDay()) % 7));
        // Ensure it's not today if today is Tuesday 20:00 (closed)
        const today = new Date();
        if (d.getDate() === today.getDate()) {
            d.setDate(d.getDate() + 7);
        }

        const dateStr = d.toISOString().split('T')[0];

        // Assuming shop is open on Tuesday
        const res = await request(app)
            .get(`/api/slots?date=${dateStr}&adminId=${workerId}`)
            .expect(200);

        // Should return slots
        expect(Array.isArray(res.body.slots)).toBe(true);
        expect(res.body.slots.length).toBeGreaterThan(0);
    });
});
