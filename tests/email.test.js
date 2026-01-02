const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const emailService = require('../server/services/emailService');

// Mock nodemailer
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
nodemailer.createTransport.mockReturnValue({
    sendMail: mockSendMail
});

describe('Email Service (TDD)', () => {

    beforeAll(async () => {
        await db.initPromise;
        // Seed Settings with Email Config
        await db.setSetting('email_config', ({
            user: 'test-salon@gmail.com',
            pass: 'secure-app-password'
        }));
    });

    afterAll(async () => {
        // Cleanup settings
        await db.setSetting('email_config', null);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('Should send confirmation email when triggered', async () => {
        const bookingData = {
            name: 'Jean Test',
            date: '2025-01-01',
            time: '14:00',
            service: 'Coupe Homme',
            workerName: 'Yassine',
            to: 'client@example.com'
        };

        await emailService.sendConfirmation(bookingData);



        expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
        const transportConfig = nodemailer.createTransport.mock.calls[0][0];

        // Non-regression assertions
        expect(transportConfig).toMatchObject({
            family: 4, // Force IPv4
            connectionTimeout: 10000,
            secure: true, // Port 465 default
            tls: { rejectUnauthorized: false }
        });

        expect(mockSendMail).toHaveBeenCalled();

        const mailOptions = mockSendMail.mock.calls[0][0];
        expect(mailOptions.to).toBe('client@example.com');
        expect(mailOptions.subject).toContain('Confirmation');
        expect(mailOptions.html).toContain('Jean Test');
        // Check for ICS attachment or link
        expect(mailOptions.attachments).toBeDefined();
        expect(mailOptions.attachments[0].filename).toBe('invite.ics');
    });

    test('Should NOT throw error if email config is missing', async () => {
        // Unset config
        await db.setSetting('email_config', null);

        const bookingData = {
            name: 'No Config',
            date: '2025-01-01',
            time: '14:00',
            service: 'Test',
            workerName: 'Worker',
            to: 'client@example.com'
        };

        await expect(emailService.sendConfirmation(bookingData)).resolves.not.toThrow();
        // Should not have called sendMail because no config
        expect(mockSendMail).not.toHaveBeenCalled();
    });

    test('Should NOT throw error if client email is missing', async () => {
        // Reset config
        await db.setSetting('email_config', { user: 'test', pass: 'test' });

        const bookingData = {
            name: 'No Email Client',
            date: '2025-01-01',
            time: '14:00',
            service: 'Test',
            workerName: 'Worker',
            to: null // No email provided
        };

        await expect(emailService.sendConfirmation(bookingData)).resolves.not.toThrow();
        expect(mockSendMail).not.toHaveBeenCalled();
    });
});
