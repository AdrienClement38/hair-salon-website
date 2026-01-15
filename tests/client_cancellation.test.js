
const appointmentService = require('../server/services/appointmentService');
const emailService = require('../server/services/emailService');
const db = require('../server/models/database');
const polling = require('../server/config/polling');
const waitingListService = require('../server/services/waitingListService');

describe('Client Cancellation Feature', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should generate a consistent secure token', () => {
        const appt = { id: 123, email: 'test@example.com', date: '2026-06-01' };

        const token1 = emailService.generateCancellationToken(appt);
        const token2 = emailService.generateCancellationToken(appt);

        expect(token1).toBeDefined();
        expect(token1).toBe(token2);

        // Verify tamper resistance
        const tamperedAppt = { ...appt, id: 124 };
        const token3 = emailService.generateCancellationToken(tamperedAppt);
        expect(token1).not.toBe(token3);
    });

    it('should cancel appointment and trigger side effects', async () => {
        // Appt Data
        const mockAppt = {
            id: 999,
            date: '2026-06-01',
            time: '14:00',
            service: 'Coupe', // Name
            admin_id: 1,
            email: 'client@test.com'
        };

        // Mock DB
        jest.spyOn(db, 'getAppointmentById').mockResolvedValue(mockAppt);
        jest.spyOn(db, 'deleteAppointment').mockResolvedValue(true);

        // Mock Settings for Duration lookup
        jest.spyOn(db, 'getSetting').mockImplementation(async (key) => {
            if (key === 'services') return [{ name: 'Coupe', duration: 45 }];
            if (key === 'email_config') return { user: 'u', pass: 'p' };
            return null;
        });

        jest.spyOn(db, 'getAdminById').mockResolvedValue({ display_name: 'Coiffeur Bob' });

        // Spies on Side Effects
        const processCancellationSpy = jest.spyOn(waitingListService, 'processCancellation').mockResolvedValue(true);
        const triggerUpdateSpy = jest.spyOn(polling, 'triggerUpdate').mockImplementation(() => { });
        const sendCancellationEmailSpy = jest.spyOn(emailService, 'sendCancellation').mockResolvedValue(true);

        // Execute
        const result = await appointmentService.cancelAppointment(999, {
            source: 'client',
            reason: 'Test Reason',
            sendEmail: true
        });

        // Assertions
        expect(result.success).toBe(true);

        // 1. DB Delete
        expect(db.deleteAppointment).toHaveBeenCalledWith(999);

        // 2. Waitlist Triggered with Correct Duration (from service lookup)
        expect(processCancellationSpy).toHaveBeenCalledWith(
            mockAppt.date,
            mockAppt.time,
            45, // Duration 45 from settings mock
            mockAppt.admin_id
        );

        // 3. Polling Triggered
        expect(triggerUpdateSpy).toHaveBeenCalled();

        // 4. Email Sent
        expect(sendCancellationEmailSpy).toHaveBeenCalledWith(mockAppt, expect.objectContaining({
            reason: 'Test Reason',
            workerName: 'Coiffeur Bob'
        }));
    });

    it('should handle non-existent appointment gracefully', async () => {
        jest.spyOn(db, 'getAppointmentById').mockResolvedValue(null);
        const result = await appointmentService.cancelAppointment(99999);
        expect(result.success).toBe(false);
        expect(result.message).toContain('not found');
    });
});
