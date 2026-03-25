const db = require('../server/models/database');

describe('Database Loyalty Features', () => {
    const testEmail = 'loyalty_test@example.com';
    const testName = 'Loyalty Client';

    beforeAll(async () => {
        await db.initPromise;
        // Cleanup
        await db.run("DELETE FROM appointments WHERE email = ?", [testEmail]);
        await db.run("DELETE FROM clients WHERE email = ?", [testEmail]);
    });

    afterAll(async () => {
        await db.run("DELETE FROM appointments WHERE email = ?", [testEmail]);
        await db.run("DELETE FROM clients WHERE email = ?", [testEmail]);
    });

    test('getAllAppointments should join with clients to provide loyalty_points', async () => {
        // 1. Create a client with points
        await db.upsertClientLoyalty(testEmail, testName, '0123456789', true);
        // Manually set points to 5 for testing join
        await db.run("UPDATE clients SET loyalty_points = 5 WHERE email = ?", [testEmail]);

        // 2. Create an appointment for this client
        await db.createBooking(testName, '2025-05-10', '10:00', 'Coupe', '0123456789', null, testEmail);

        // 3. Fetch all appointments
        const appts = await db.getAllAppointments();
        const myAppt = appts.find(a => a.email === testEmail);

        expect(myAppt).toBeDefined();
        // This is the TDD part: it should have loyalty_points property
        expect(myAppt.loyalty_points).toBe(5);
    });

    test('getAllClients should return all registered clients', async () => {
        // We know at least 'loyalty_test@example.com' exists from previous test
        if (typeof db.getAllClients !== 'function') {
            throw new Error('db.getAllClients is not a function (TDD: Implementation pending)');
        }
        
        const clients = await db.getAllClients();
        const found = clients.find(c => c.email === testEmail);
        
        expect(Array.isArray(clients)).toBe(true);
        expect(found).toBeDefined();
        expect(found.name).toBe(testName);
        expect(found.loyalty_points).toBe(5);
    });
});
