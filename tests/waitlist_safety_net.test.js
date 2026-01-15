
const db = require('../server/models/database');

describe('Waitlist Safety Net (Boundaries & Breaks)', () => {
    const testDate = '2026-02-01'; // Future date
    const workerId = 1;

    let hours = [];

    beforeAll(async () => {
        if (process.env.NODE_ENV !== 'test') throw new Error('Run strictly in test mode');
        await db.init();

        // STRICT CONFIGURATION (Saturated - same for day 0-6 to ignore timezone issues)
        // 09:00 - 17:00. Break 12:00 - 14:00.
        // Valid slots: 09:00-12:00, 14:00-17:00.
        const baseConfig = { start: '09:00', end: '17:00', pause_start: '12:00', pause_end: '14:00' };

        hours = [];
        for (let i = 0; i < 7; i++) hours.push({ ...baseConfig, day: i });
        // We don't need db.run anymore for settings, we inject them

        // Mock Services (Duration default to 30 if failed, but let's be safe)
        // Not strictly needed as we just check gaps logic (which depends on appt duration, but we insert appts manually)
    });

    beforeEach(async () => {
        await db.run("DELETE FROM appointments");
    });

    const getGaps = async () => await db.getDailyGaps(testDate, workerId, hours);

    test('Scenario 1: Break Overlap - Should NOT find gap starting at 12:00 (Break Start)', async () => {
        // Appt 11:30 - 12:00 (Valid, touches break start)
        await db.createBooking('Pre-Break', testDate, '11:00', 'Generic Service', '000', workerId, 'f1@t.com');
        // Note: Default duration is 30. So 11:00-11:30.
        // Use manual bookings query? No, createBooking is safer.
        // Need to ensure duration.
        // "Generic Service" doesn't exist -> Default 30 min.

        await db.createBooking('Appt 1', testDate, '11:30', 'Generic Service', '000', workerId, 'f1@t.com');
        // 11:30 - 12:00.

        // Next availability would normally be 12:00.
        // But 12:00-14:00 is Break.
        // Safety Net should prevent 12:00.

        const gaps = await getGaps();
        const gapAt12 = gaps.find(g => g.start === '12:00');
        expect(gapAt12).toBeUndefined();
    });

    test('Scenario 2: Closing Time - Should NOT find gap after 17:00', async () => {
        // Appt 16:30 - 17:00.
        await db.createBooking('Pre-Close', testDate, '16:30', 'Generic Service', '000', workerId, 'f2@t.com');

        // Next is 17:00. But Closing is 17:00.
        const gaps = await getGaps();
        const gapAt17 = gaps.find(g => g.start === '17:00');
        expect(gapAt17).toBeUndefined();

        const gapAfter17 = gaps.find(g => g.start > '17:00');
        expect(gapAfter17).toBeUndefined();
    });

    test('Scenario 3: Opening Time - Should NOT find gap before 09:00', async () => {
        const gaps = await getGaps();
        const gapBefore9 = gaps.find(g => g.start < '09:00');
        expect(gapBefore9).toBeUndefined();

        // Ensure 09:00 exists (it's free)
        const gapAt9 = gaps.find(g => g.start === '09:00');
        expect(gapAt9).toBeDefined();
    });

    test('Scenario 4: Valid Adjacent - Gap ENDING at Break Start (11:30-12:00) IS Valid', async () => {
        // Appt 09:00 - 11:30
        // Wait, default duration is 30.
        // Let's rely on "Generic Service" defaulting.
        // We want a gap 11:30-12:00.
        // So we fill 09:00 -> 11:30.
        // 09:00, 09:30, 10:00, 10:30, 11:00.
        await db.createBooking('F1', testDate, '09:00', 'Generic Service', '000', workerId, 'f@t.com');
        await db.createBooking('F2', testDate, '09:30', 'Generic Service', '000', workerId, 'f@t.com');
        await db.createBooking('F3', testDate, '10:00', 'Generic Service', '000', workerId, 'f@t.com');
        await db.createBooking('F4', testDate, '10:30', 'Generic Service', '000', workerId, 'f@t.com');
        await db.createBooking('F5', testDate, '11:00', 'Generic Service', '000', workerId, 'f@t.com'); // Ends 11:30

        // 11:30 - 12:00 is Free. 12:00 is Break Start.
        // Gap End (12:00) <= Break Start (12:00).
        // Should be kept.

        const gaps = await getGaps();
        const targetGap = gaps.find(g => g.start === '11:30');
        expect(targetGap).toBeDefined();
        if (targetGap) {
            expect(targetGap.end).toBe('12:00');
        }
    });
});
