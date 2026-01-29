const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Leaves Filtering Tests', () => {
    let token;
    let adminId;
    let workerId;

    beforeAll(async () => {
        await db.initPromise;

        // 1. Create Main Admin and Login
        const mainAdminUser = 'admin_filter_test_' + Date.now();
        const hash = await bcrypt.hash('password123', 10);
        const adminRes = await db.createAdmin(mainAdminUser, hash, 'Main Admin');
        adminId = adminRes.lastInsertRowid; // Depending on DB type, might be ID. 

        // The app uses Basic Auth, not JWT.
        // We simulate this by constructing the header directly.
        const authHeader = 'Basic ' + Buffer.from(mainAdminUser + ':password123').toString('base64');
        token = authHeader; // We'll reuse the 'token' variable to hold the full header value for convenience, or rename it.

        // 2. Create a Worker
        const workerUser = 'worker_filter_test_' + Date.now();
        const workerRes = await db.createAdmin(workerUser, hash, 'Worker One'); // Worker is just an admin
        workerId = workerRes.lastInsertRowid;

        // 3. Create Leaves
        // Global Leave (adminId is null)
        await db.createLeave('2099-01-01', '2099-01-02', null, 'Global Closure');

        // Worker Leave (adminId is set)
        await db.createLeave('2099-02-01', '2099-02-02', workerId, 'Worker Holiday');

        // Main Admin Leave (adminId is set) - noise
        await db.createLeave('2099-03-01', '2099-03-02', adminId, 'Main Admin Holiday');
    });

    afterAll(async () => {
        // Cleanup
        await db.query("DELETE FROM leaves WHERE start_date LIKE '2099-%'");
        await db.query("DELETE FROM admins WHERE id IN (?, ?)", [adminId, workerId]);
    });

    test('Should return ONLY Global leaves when adminId is literal "null" or empty string (Salon View)', async () => {
        // Case A: adminId = '' (Common frontend case for Salon)
        const resEmpty = await request(app)
            .get('/api/admin/leaves?adminId=')
            .set('Authorization', token);

        expect(resEmpty.statusCode).toBe(200);
        const globalLeaves = resEmpty.body;
        // Should contain Global Closure
        expect(globalLeaves.some(l => l.note === 'Global Closure')).toBe(true);
        // Should NOT contain Worker Holiday
        expect(globalLeaves.some(l => l.note === 'Worker Holiday')).toBe(false);


        // Case B: adminId = 'null' (String from frontend param potentially)
        // If the frontend sends ?adminId=null literal string
        const resNull = await request(app)
            .get('/api/admin/leaves?adminId=null')
            .set('Authorization', token);

        expect(resNull.statusCode).toBe(200);
        expect(resNull.body.some(l => l.note === 'Global Closure')).toBe(true);
        expect(resNull.body.some(l => l.note === 'Worker Holiday')).toBe(false);
    });

    test('Should return ONLY Worker leaves when adminId is a valid ID', async () => {
        const res = await request(app)
            .get(`/api/admin/leaves?adminId=${workerId}`)
            .set('Authorization', token);

        expect(res.statusCode).toBe(200);
        const workerLeaves = res.body;

        // Should contain Worker Holiday
        expect(workerLeaves.some(l => l.note === 'Worker Holiday')).toBe(true);
        // Should NOT contain Global Closure
        expect(workerLeaves.some(l => l.note === 'Global Closure')).toBe(false);
        // Should NOT contain Main Admin Holiday
        expect(workerLeaves.some(l => l.note === 'Main Admin Holiday')).toBe(false);
    });

    test('Should return Worker AND Global leaves when adminId is valid AND strict=false (Calendar View)', async () => {
        const res = await request(app)
            .get(`/api/admin/leaves?adminId=${workerId}&strict=false`)
            .set('Authorization', token);

        expect(res.statusCode).toBe(200);
        const calendarLeaves = res.body;

        // Should return BOTH
        expect(calendarLeaves.some(l => l.note === 'Worker Holiday')).toBe(true);
        expect(calendarLeaves.some(l => l.note === 'Global Closure')).toBe(true);
        // But NOT Main Admin Holiday (noise)
        expect(calendarLeaves.some(l => l.note === 'Main Admin Holiday')).toBe(false);
    });

    test('Should return ALL leaves when no adminId query param is provided (Legacy/Safety)', async () => {
        // This behavior ensures we don't break existing calls that expect everything if they forget the param
        const res = await request(app)
            .get('/api/admin/leaves')
            .set('Authorization', token);

        expect(res.statusCode).toBe(200);
        const allLeaves = res.body;

        expect(allLeaves.some(l => l.note === 'Global Closure')).toBe(true);
        expect(allLeaves.some(l => l.note === 'Worker Holiday')).toBe(true);
    });

});
