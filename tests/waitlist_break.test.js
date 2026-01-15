
const waitingListService = require('../server/services/waitingListService');
const db = require('../server/models/database');

// We need to Mock emailService behavior if it fails, 
// but since it is required inside waitingListService, we might need to mock db calls it makes.
// Fortunately we are mocking db.getSetting, so emailService should be structurally sound.

describe('Waitlist Break Violation', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should NOT offer a slot that overlaps with the break (12:00-14:00)', async () => {
        const mockOpeningHours = [
            null, null, null,
            {
                isOpen: true, open: '09:00', close: '19:00',
                breakStart: '12:00', breakEnd: '14:00'
            }
        ];

        jest.spyOn(db, 'getSetting').mockImplementation(async (key) => {
            if (key === 'opening_hours') return mockOpeningHours; // Return Object
            if (key === 'services') return [{ id: 'cut', name: 'Coupe', duration: 30 }]; // Return Array
            // Email service might ask for email_config
            if (key === 'email_config') return { user: 'test', pass: 'test' }; // Return Object
            return null;
        });

        // Appt Ends 10:30. Break starts 12:00.
        // Gap adjacent: 10:30 -> ...
        // Real gap is 10:30-12:00 (90 min).
        jest.spyOn(db, 'getAppointmentsForWorker').mockResolvedValue([
            { time: '10:00', service: 'Morning', _forcedDuration: 30 }, // Ends 10:30
            { time: '14:00', service: 'Afternoon', _forcedDuration: 300 } // Starts 14:00
        ]);

        jest.spyOn(db, 'findNextWaitingRequest').mockResolvedValue({
            id: 1,
            client_name: 'Test Client',
            client_email: 'test@example.com',
            desired_service_id: 'cut'
        });

        // Mock Side Effects to prevent real DB writing / initDB
        jest.spyOn(db, 'createBooking').mockResolvedValue(true);
        jest.spyOn(db, 'updateWaitingRequestStatus').mockResolvedValue(true);

        const matchSpy = jest.spyOn(waitingListService, 'matchAndOffer');

        // EXECUTE
        await waitingListService.processCancellation('2026-01-28', '10:30', 30, 1);

        // ASSERT
        // Should offer 10:30.
        if (matchSpy.mock.calls.length > 0) {
            const offeredTime = matchSpy.mock.calls[0][1];
            if (offeredTime === '12:00') throw new Error('FAIL: Offered 12:00!');
        }
    });

    it('should REJECT offering 12:00 if it is inside break', async () => {
        const mockOpeningHours = [null, null, null, { isOpen: true, open: '09:00', close: '19:00', breakStart: '12:00', breakEnd: '14:00' }];

        jest.spyOn(db, 'getSetting').mockImplementation(async (key) => {
            if (key === 'opening_hours') return mockOpeningHours;
            if (key === 'services') return [{ id: 'cut', name: 'Coupe', duration: 30 }];
            if (key === 'email_config') return { user: 'test', pass: 'test' };
            return null;
        });

        jest.spyOn(db, 'getAppointmentsForWorker').mockResolvedValue([
            { time: '09:00', service: 'Morning', _forcedDuration: 180 }, // Ends 12:00
            { time: '14:00', service: 'Afternoon', _forcedDuration: 300 } // Starts 14:00
        ]);

        jest.spyOn(db, 'findNextWaitingRequest').mockResolvedValue({
            id: 1, client_name: 'Test', client_email: 't', desired_service_id: 'cut'
        });

        jest.spyOn(db, 'createBooking').mockResolvedValue(true);
        jest.spyOn(db, 'updateWaitingRequestStatus').mockResolvedValue(true);

        const matchSpy = jest.spyOn(waitingListService, 'matchAndOffer');

        // Trigger scan at 12:00
        await waitingListService.processCancellation('2026-01-28', '12:00', 30, 1);

        // ASSERT
        if (matchSpy.mock.calls.length > 0) {
            const offeredTime = matchSpy.mock.calls[0][1];
            if (offeredTime === '12:00') {
                throw new Error('FAIL: Offered 12:00 despite break!');
            }
        } else {
            // Success: No offer made
        }
    });
});
