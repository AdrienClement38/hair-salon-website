const db = require('../server/models/database');
const request = require('supertest');

describe('Data Cleanup Logic', () => {

    beforeAll(async () => {
        await db.initPromise;
    });

    test('Should purge appointments older than 7 days', async () => {
        // Helpers for Date Maths
        const today = new Date();

        const formatDate = (daysDelta) => {
            const d = new Date(today);
            d.setDate(d.getDate() + daysDelta);
            return d.toISOString().split('T')[0];
        };

        const oldDate = formatDate(-8); // 8 days ago
        const borderLineDate = formatDate(-7); // 7 days ago (Should be KEPT or DELETED? "One week after". Usually > 7 days. Let's say keep 7 days history.)
        // Logic: cleanup "One week AFTER the date". So on J+8, J is deleted.
        // If today is 2023-01-08. Date of RDV: 2023-01-01. Diff = 7 days.
        // If we want "no trace after a week", imply Strict > 7 days old.

        const recentDate = formatDate(-6); // 6 days ago
        const futureDate = formatDate(1); // Tomorrow

        // 1. Inject Data directly
        // We need unique IDs or just rely on auto-id
        const insert = async (date, name) => {
            if (db.type === 'pg') {
                await db.run('INSERT INTO appointments (name, service, date, time) VALUES ($1, $2, $3, $4)', [name, 'Test', date, '10:00']);
            } else {
                await db.run('INSERT INTO appointments (name, service, date, time) VALUES (?, ?, ?, ?)', [name, 'Test', date, '10:00']);
            }
        };

        await insert(oldDate, 'TO_BE_DELETED');
        await insert(recentDate, 'TO_BE_KEPT_RECENT');
        await insert(futureDate, 'TO_BE_KEPT_FUTURE');

        // Ensure inserted
        const allBefore = await db.getAllAppointments();
        expect(allBefore.some(a => a.name === 'TO_BE_DELETED')).toBe(true);
        expect(allBefore.some(a => a.name === 'TO_BE_KEPT_RECENT')).toBe(true);

        // 2. Call Purge
        if (typeof db.purgeOldAppointments !== 'function') {
            throw new Error("Function purgeOldAppointments not implemented yet (TDD RED)");
        }
        const result = await db.purgeOldAppointments();
        console.log("Purged:", result);

        // 3. Verify
        const allAfter = await db.getAllAppointments();

        const oldExists = allAfter.some(a => a.name === 'TO_BE_DELETED');
        const recentExists = allAfter.some(a => a.name === 'TO_BE_KEPT_RECENT');
        const futureExists = allAfter.some(a => a.name === 'TO_BE_KEPT_FUTURE');

        expect(oldExists).toBe(false); // Should be gone
        expect(recentExists).toBe(true);
        expect(futureExists).toBe(true);

    });
});
