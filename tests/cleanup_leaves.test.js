const db = require('../server/models/database');

describe('Database Cleanup Logic', () => {

    beforeAll(async () => {
        // Initialize DB in test mode (uses mostly in-memory or temp file logic from database.js)
        process.env.NODE_ENV = 'test';
        await db.initPromise;

        // Ensure table is empty
        await db.query('DELETE FROM leaves');
    });

    afterAll(async () => {
        // Cleanup
        await db.query('DELETE FROM leaves');
    });

    test('purgeOldLeaves should delete only past holidays', async () => {
        const today = new Date();

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const todayStr = today.toISOString().split('T')[0];

        // 1. Insert Test Data
        // Past holiday (Should be deleted)
        await db.query('INSERT INTO leaves (start_date, end_date, admin_id, note) VALUES (?, ?, ?, ?)',
            ['2000-01-01', yesterdayStr, 1, 'Past Holiday']);

        // Future holiday (Should stay)
        await db.query('INSERT INTO leaves (start_date, end_date, admin_id, note) VALUES (?, ?, ?, ?)',
            ['2000-01-01', tomorrowStr, 1, 'Future Holiday']);

        // Current holiday ending today (Should stay because end_date < today is false if end_date == today)
        // User requirement: "supprime uniquement APRES la fin" -> so if today is last day, it stays. Deletes tomorrow.
        await db.query('INSERT INTO leaves (start_date, end_date, admin_id, note) VALUES (?, ?, ?, ?)',
            ['2000-01-01', todayStr, 1, 'Present Holiday']);

        // Verify insertion
        let rows = await db.query('SELECT * FROM leaves');
        expect(rows.length).toBe(3);

        // 2. Run Cleanup
        const result = await db.purgeOldLeaves();
        console.log('Cleanup Result:', result);

        // 3. Verify Results
        rows = await db.query('SELECT * FROM leaves');

        // We expect "Past Holiday" to be gone.
        // "Future Holiday" and "Present Holiday" should remain.
        expect(rows.length).toBe(2);

        const notes = rows.map(r => r.note);
        expect(notes).toContain('Future Holiday');
        expect(notes).toContain('Present Holiday');
        expect(notes).not.toContain('Past Holiday');
    });
});
