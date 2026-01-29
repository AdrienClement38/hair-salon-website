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

    test('Should create a worker with days off (Wednesday=3)', async () => {
        const payload = {
            username: 'wednesdays_off',
            password: 'password123',
            displayName: 'No Wednesday',
            daysOff: [3] // Wednesday to avoid Monday closure conflict
        };

        const res = await request(app)
            .post('/api/admin/workers')
            .set('Authorization', adminToken)
            .send(payload);

        expect(res.status).toBe(200);

        const list = await request(app).get('/api/admin/workers').set('Authorization', adminToken);
        const worker = list.body.find(w => w.username === 'wednesdays_off');
        expect(worker).toBeDefined();
        workerId = worker.id;
        expect(worker.daysOff).toEqual([3]);
    });

    test('Should NOT have slots on Wednesday', async () => {
        // Find next Wednesday
        const d = new Date();
        d.setDate(d.getDate() + ((3 + 7 - d.getDay()) % 7));
        if (d.getDay() !== 3) d.setDate(d.getDate() + 7);

        const dateStr = d.toISOString().split('T')[0];

        const res = await request(app)
            .get(`/api/slots?date=${dateStr}&adminId=${workerId}`)
            .expect(200);

        expect(res.body.slots).toEqual([]);
        expect(res.body.reason).toBe('worker_off_day');
    });

    test('Should HAVE slots on Tuesday', async () => {
        // Find next Tuesday
        const d = new Date();
        d.setDate(d.getDate() + ((2 + 7 - d.getDay()) % 7));
        const today = new Date();
        if (d.getDate() === today.getDate()) {
            d.setDate(d.getDate() + 7);
        }

        const dateStr = d.toISOString().split('T')[0];

        const res = await request(app)
            .get(`/api/slots?date=${dateStr}&adminId=${workerId}`)
            .expect(200);

        expect(Array.isArray(res.body.slots)).toBe(true);
        // If Tuesday isn't closed globally, this should pass.
        // Assuming open since user said Mon/Sun closed usually.
        expect(res.body.slots.length).toBeGreaterThan(0);
    });
});
