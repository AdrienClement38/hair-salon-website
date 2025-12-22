const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

describe('Synchronization Logic (Polling)', () => {

    let authHeader;

    beforeAll(async () => {
        await db.initPromise;

        // Ensure manager exists
        try {
            const hash = await bcrypt.hash('password123', 10);
            await db.createAdmin('sync_manager', hash, 'Sync Manager');
        } catch (e) { }

        const token = Buffer.from('sync_manager:password123').toString('base64');
        authHeader = `Basic ${token}`;
    });

    afterAll(async () => {
        await db.deleteAdmin('sync_manager');
        // Clean up test data?
        // We will create bookings. Ideally delete them.
        // We will change settings.
    });

    // Helper to get current TS
    async function getTimestamps() {
        const res = await request(app).get('/api/updates');
        return res.body;
    }

    test('Sync-1: Public Booking triggers Appointment Update', async () => {
        // 1. Get current state
        const initial = await getTimestamps();
        const lastApptTS = initial.apptTimestamp;

        // Calculate a valid date (tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const bookingData = {
            name: 'Sync Client',
            phone: '0600000000',
            service: 'Sync Cut',
            date: dateStr,
            time: '12:00',
            adminId: null
        };
        const bookRes = await request(app).post('/api/book').send(bookingData);
        expect(bookRes.statusCode).toBe(200);

        // 3. Check Updates
        // Client sends THEIR last seen TS. If server TS is newer, returning true.
        const checkRes = await request(app).get(`/api/updates?lastAppt=${lastApptTS}`);

        expect(checkRes.body.needsApptUpdate).toBe(true);
        expect(checkRes.body.apptTimestamp).toBeGreaterThan(lastApptTS);

        // Cleanup booking
        if (bookRes.body.id) await db.deleteAppointment(bookRes.body.id);
    });

    test('Sync-2: Admin Settings Update triggers Settings Update', async () => {
        const initial = await getTimestamps();
        const lastSettingsTS = initial.settingsTimestamp;

        // Update Services
        const services = [{ name: 'Sync Service', price: 10, icon: 'star' }];
        const updateRes = await request(app)
            .post('/api/admin/settings')
            .set('Authorization', authHeader)
            .send({ services });

        expect(updateRes.statusCode).toBe(200);

        // Check Updates
        const checkRes = await request(app).get(`/api/updates?lastSettings=${lastSettingsTS}`);

        expect(checkRes.body.needsSettingsUpdate).toBe(true);
        expect(checkRes.body.settingsTimestamp).toBeGreaterThan(lastSettingsTS);
    });

    test('Sync-3: Start/End Request timestamps interact correctly', async () => {
        // If client sends current server timestamp, should return false
        const current = await getTimestamps();
        const checkRes = await request(app).get(`/api/updates?lastSettings=${current.settingsTimestamp}&lastAppt=${current.apptTimestamp}`);

        expect(checkRes.body.needsSettingsUpdate).toBe(false);
        expect(checkRes.body.needsApptUpdate).toBe(false);
    });

});
