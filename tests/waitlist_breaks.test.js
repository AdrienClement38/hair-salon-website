
const waitingListService = require('../server/services/waitingListService');
const db = require('../server/models/database');
const emailService = require('../server/services/emailService');

jest.mock('../server/models/database');
jest.mock('../server/services/emailService');

describe('Waitlist Safety Checks (Breaks & Hours)', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    const mockServices = [
        { id: 'cut', name: 'Coupe', duration: 30 }
    ];

    it('should NOT offer a slot if it falls inside a break (12:00-14:00)', async () => {
        // 1. Setup Opening Hours with Break
        // Day 3 (Wednesday)
        const oph = {
            3: {
                day: 3,
                open: "09:30",
                close: "19:00",
                breakStart: "12:00",
                breakEnd: "14:00"
            }
        };

        db.getSetting.mockImplementation(async (key) => {
            if (key === 'opening_hours') return oph;
            if (key === 'services') return mockServices;
            return null;
        });

        // 2. Setup Appointments: Minimal
        db.getAppointmentsForWorker.mockResolvedValue([]);
        db.createBooking.mockResolvedValue({ lastInsertRowid: 123 });
        db.updateWaitingRequestStatus.mockResolvedValue(true);

        // 3. Spy on matchAndOffer to ensure it is NOT called
        const matchSpy = jest.spyOn(waitingListService, 'matchAndOffer');

        // 4. Simulate cancellation at 12:30 (Inside Break)
        // Date: 2026-01-28 is a Wednesday
        await waitingListService.processCancellation('2026-01-28', '12:30', 30, 1);

        // 5. Assertions
        expect(matchSpy).not.toHaveBeenCalled();
    });

    it('should NOT offer a slot if it falls AFTER closing time (12:00)', async () => {
        // Day 3 (Wednesday) Ends at 12:00
        const oph = {
            3: {
                day: 3,
                open: "09:30",
                close: "12:00"
                // No break, just closes early
            }
        };

        db.getSetting.mockImplementation(async (key) => {
            if (key === 'opening_hours') return oph;
            if (key === 'services') return mockServices;
            return null;
        });

        db.getAppointmentsForWorker.mockResolvedValue([]);
        const matchSpy = jest.spyOn(waitingListService, 'matchAndOffer');

        // Simulate cancellation at 12:30 (After Close)
        await waitingListService.processCancellation('2026-01-28', '12:30', 30, 1);

        expect(matchSpy).not.toHaveBeenCalled();
    });

    it('should offer a slot if it is valid (10:00)', async () => {
        const oph = {
            3: {
                day: 3,
                open: "09:30",
                close: "19:00",
                breakStart: "12:00",
                breakEnd: "14:00"
            }
        };

        db.getSetting.mockImplementation(async (key) => {
            if (key === 'opening_hours') return oph;
            if (key === 'services') return mockServices;
            return null;
        });

        db.getAppointmentsForWorker.mockResolvedValue([]);
        db.createBooking.mockResolvedValue({ lastInsertRowid: 123 });
        db.updateWaitingRequestStatus.mockResolvedValue(true);

        // Mock finding a request
        db.findNextWaitingRequest.mockResolvedValue({
            id: 1, client_name: 'Test', desired_service_id: 'Coupe'
        });

        const matchSpy = jest.spyOn(waitingListService, 'matchAndOffer');

        // Simulate cancellation at 10:00 (Valid)
        await waitingListService.processCancellation('2026-01-28', '10:00', 30, 1);

        expect(matchSpy).toHaveBeenCalled();
    });
});
