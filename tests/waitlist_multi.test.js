
const waitingListService = require('../server/services/waitingListService');
const db = require('../server/models/database');

describe('Waitlist Multi-Slot Filling (Recursive)', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should fill a 30m gap with two 15m requests', async () => {
        const testDate = '2026-05-20';

        // Mock Settings
        // Opening hours don't matter much as long as we force the gap logic
        jest.spyOn(db, 'getSetting').mockImplementation(async (key) => {
            if (key === 'opening_hours') return { 1: { start: "09:00", end: "19:00" } }; // Simple
            if (key === 'services') return [
                { id: 'beard', name: 'Barbe', duration: 15 },
                { id: 'cut', name: 'Coupe', duration: 30 }
            ];
            if (key === 'email_config') return { user: 'test', pass: 'test' };
            return null;
        });

        // Mock `getAppointmentsForWorker` to create a clean slate or irrelevant appts
        // actually processCancellation logic calculates gap from deleted slot.
        // We delete 10:00 - 10:30 (30 min).
        // Best Start will be 10:00. Best End will be 10:30 (assuming surrounding appts).
        jest.spyOn(db, 'getAppointmentsForWorker').mockResolvedValue([
            { time: '09:00', service: 'Morning', _forcedDuration: 60 }, // Ends 10:00
            { time: '10:30', service: 'Afternoon', _forcedDuration: 60 } // Starts 10:30
        ]);

        // Mock `findNextWaitingRequest` to return 2 different people sequentially
        const findStub = jest.spyOn(db, 'findNextWaitingRequest');

        // First Call: Returns Client A (15 min)
        findStub.mockResolvedValueOnce({
            id: 101, client_name: 'Client A', client_email: 'a@test.com', desired_service_id: 'Barbe'
        });

        // Second Call: Returns Client B (15 min)
        findStub.mockResolvedValueOnce({
            id: 102, client_name: 'Client B', client_email: 'b@test.com', desired_service_id: 'Barbe'
        });

        // Third Call: Null (Stop)
        findStub.mockResolvedValueOnce(null);

        // Mock Side Effects
        const createBookingSpy = jest.spyOn(db, 'createBooking').mockResolvedValue(true);
        const updateStatusSpy = jest.spyOn(db, 'updateWaitingRequestStatus').mockResolvedValue(true);
        // Spy console to avoid noise or checking log calls?

        // EXPECTATION:
        // 1. processCancellation called for 30 min.
        // 2. Finds Client A. Offers 10:00.
        // 3. Logic RECURSES/LOOPS.
        // 4. Finds Client B. Offers 10:15.

        try {
            await waitingListService.processCancellation(testDate, '10:00', 30, 1);

            // ASSERTIONS
            console.log('CreateBooking Calls:', createBookingSpy.mock.calls);
            expect(createBookingSpy).toHaveBeenCalledTimes(2);

            // Check Args of first booking (Client A) -> 10:00
            expect(createBookingSpy.mock.calls[0][1]).toBe(testDate);
            expect(createBookingSpy.mock.calls[0][2]).toBe('10:00'); // Time
            expect(createBookingSpy.mock.calls[0][0]).toBe('Client A');

            // Check Args of second booking (Client B) -> 10:15
            expect(createBookingSpy.mock.calls[1][1]).toBe(testDate);
            expect(createBookingSpy.mock.calls[1][2]).toBe('10:15'); // Time should be advanced!
            expect(createBookingSpy.mock.calls[1][0]).toBe('Client B');
        } catch (e) {
            console.error('TEST ERROR DETAIL:', e);
            throw e;
        }
    });
});
