const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');
const emailService = require('../server/services/emailService');

// Mock Email Service
jest.mock('../server/services/emailService');

describe('Password Reset Flow', () => {
    let testAdminId;
    const testUsername = 'reset_test_user';
    const testPassword = 'password123';

    beforeAll(async () => {
        await db.initPromise;
        // Clean up
        await db.run('DELETE FROM admins WHERE username = ?', [testUsername]);
        // Create test user
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(testPassword, 10);
        const res = await db.createAdmin(testUsername, hash, 'Reset User');
        testAdminId = res.lastInsertRowid;

        // Mock email settings
        await db.setSetting('email_config', { user: 'test@salon.com', pass: 'secret' });
    });

    afterAll(async () => {
        await db.run('DELETE FROM admins WHERE username = ?', [testUsername]);
        await db.run('DELETE FROM password_reset_tokens WHERE admin_id = ?', [testAdminId]);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/forgot-password', () => {
        it('should send an email without requiring username', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({}); // No username provided

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify token was created in DB with special admin_id (e.g. 0 for unbound)
            const tokens = await db.run('SELECT * FROM password_reset_tokens WHERE admin_id = 0');
            expect(tokens.length).toBeGreaterThan(0);

            // Verify email service was called
            expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(1);
        });
    });

    describe('GET /api/auth/verify-token/:token', () => {
        let validToken;

        beforeEach(async () => {
            // Create a fresh UNBOUND token
            const crypto = require('crypto');
            validToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000);
            await db.createResetToken(validToken, 0, expiresAt); // 0 = Unbound
        });

        it('should validate a correct token', async () => {
            const res = await request(app).get(`/api/auth/verify-token/${validToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.valid).toBe(true);
        });

        it('should reject an invalid token', async () => {
            const res = await request(app).get('/api/auth/verify-token/invalid_token_string');
            expect(res.statusCode).toBe(404); // Or 400 depending on implementation
            expect(res.body.valid).toBe(false);
        });

        it('should reject an expired token', async () => {
            // Create expired token
            const crypto = require('crypto');
            const expiredToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() - 3600000); // 1 hour ago
            await db.createResetToken(expiredToken, testAdminId, expiresAt);

            const res = await request(app).get(`/api/auth/verify-token/${expiredToken}`);
            expect(res.statusCode).toBe(400);
            expect(res.body.valid).toBe(false);
        });
    });

    describe('POST /api/auth/reset-password', () => {
        let validToken;

        beforeEach(async () => {
            const crypto = require('crypto');
            validToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000);
            await db.createResetToken(validToken, 0, expiresAt);
        });

        it('should fail if username does not exist', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: validToken,
                    newPassword: 'newPassword123',
                    username: 'Inexistant'
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toMatch(/n'existe pas/i);
        });

        it('should reset password if username matches (reset_test_user)', async () => {
            // 'reset_test_user' is the username of our test user
            const newPassword = 'newPassword456';
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: validToken,
                    newPassword: newPassword,
                    username: testUsername // Correct Username
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify login works with new password
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ username: testUsername, password: newPassword });

            expect(loginRes.statusCode).toBe(200);
            expect(loginRes.body.success).toBe(true);

            // Verify token is deleted
            const tokenRow = await db.getResetToken(validToken);
            expect(tokenRow).toBeUndefined();
        });
    });
});
