const appointmentService = require('../server/services/appointmentService');
const db = require('../server/models/database');

jest.mock('../server/models/database');

describe('AppointmentService Availability Priorities', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Safe defaults
        db.getSetting.mockImplementation((key) => {
            if (key === 'holidays') return Promise.resolve([]);
            if (key === 'opening_hours') return Promise.resolve({ start: '09:00', end: '18:00', closedDays: [] }); // Open 7/7 mock
            if (key === 'services') return Promise.resolve([]);
            return Promise.resolve(null);
        });
        db.getLeaves.mockResolvedValue([]);
        db.getAdminById.mockResolvedValue({ days_off: '[]' });
        db.getBookingsForDate.mockResolvedValue([]);
    });

    test('Priority 1: Global Holiday overrides Worker Leave', async () => {
        const date = '2026-02-13'; // Friday

        // Setup: Global Holiday AND Worker Leave on same day
        db.getSetting.mockImplementation((key) => {
            if (key === 'holidays') return Promise.resolve([date]);
            if (key === 'opening_hours') return Promise.resolve({ start: '09:00', end: '18:00', closedDays: [] });
            return Promise.resolve([]);
        });

        // Worker has leave
        db.getLeaves.mockResolvedValue([{ start_date: date, end_date: date, admin_id: 1 }]);

        const result = await appointmentService.getAvailableSlots(date, 1);

        // Expect "holiday" (Salon Fermé) NOT "leave" (Worker Absent)
        expect(result.reason).toBe('holiday');
    });

    test('Priority 2: Weekly Closure overrides Worker Leave', async () => {
        const date = '2026-02-02'; // Monday

        // Setup: Monday is Closed in Opening Hours
        db.getSetting.mockImplementation((key) => {
            if (key === 'holidays') return Promise.resolve([]);
            if (key === 'opening_hours') return Promise.resolve({ start: '09:00', end: '18:00', closedDays: [1] }); // 1=Monday Closed
            return Promise.resolve([]);
        });

        // Worker ALSO has leave on this Monday
        db.getLeaves.mockResolvedValue([{ start_date: date, end_date: date, admin_id: 1 }]);

        const result = await appointmentService.getAvailableSlots(date, 1);

        // Expect "closed" (Salon Fermé) NOT "leave" (Worker Absent)
        expect(result.reason).toBe('closed');
    });

    test('Priority 3: Global Leave (Exception) overrides Worker Leave', async () => {
        const date = '2026-02-10'; // Tuesday

        db.getSetting.mockImplementation((key) => {
            if (key === 'holidays') return Promise.resolve([]);
            if (key === 'opening_hours') return Promise.resolve({ start: '09:00', end: '18:00', closedDays: [] });
            return Promise.resolve([]);
        });

        // Global Leave (admin_id: null) AND Personal Leave (admin_id: 1)
        db.getLeaves.mockResolvedValue([
            { start_date: date, end_date: date, admin_id: null }, // Global
            { start_date: date, end_date: date, admin_id: 1 }    // Personal
        ]);

        const result = await appointmentService.getAvailableSlots(date, 1);

        // Expect "closed" (mapped from Global Leave logic)
        expect(result.reason).toBe('closed');
    });

    test('Priority 4: Worker Off Day overrides general availability', async () => {
        const date = '2026-02-03'; // Tuesday

        db.getSetting.mockImplementation((key) => {
            if (key === 'holidays') return Promise.resolve([]);
            if (key === 'opening_hours') return Promise.resolve({ start: '09:00', end: '18:00', closedDays: [] }); // Open
            return Promise.resolve([]);
        });

        // Worker has Tuesday (2) as Off Day
        db.getAdminById.mockResolvedValue({ days_off: '[2]' }); // 2=Tuesday

        const result = await appointmentService.getAvailableSlots(date, 1);

        expect(result.reason).toBe('worker_off_day');
    });

    test('Priority 5: Worker Personal Leave triggers absence message', async () => {
        const date = '2026-02-04'; // Wednesday

        db.getSetting.mockImplementation((key) => {
            if (key === 'holidays') return Promise.resolve([]);
            if (key === 'opening_hours') return Promise.resolve({ start: '09:00', end: '18:00', closedDays: [] });
            return Promise.resolve([]);
        });

        // Worker Leave only
        db.getLeaves.mockResolvedValue([{ start_date: date, end_date: date, admin_id: 1 }]);

        const result = await appointmentService.getAvailableSlots(date, 1);

        expect(result.reason).toBe('leave');
    });
});
