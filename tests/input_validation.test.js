const request = require('supertest');
const app = require('../server/app');
const db = require('../server/models/database');

// Mock Auth Middleware to bypass login for these tests
jest.mock('../server/middleware/auth', () => (req, res, next) => {
    req.user = { id: 1, username: 'admin' };
    next();
});

describe('Input Validation Security (TDD)', () => {

    beforeAll(async () => {
        // Init DB logic if needed, but we likely just checking middleware reject
        // validation runs before controller logic.
    });

    describe('POST /api/admin/workers', () => {
        it('should reject XSS in displayname', async () => {
            const res = await request(app)
                .post('/api/admin/workers')
                .send({
                    username: 'testworker',
                    password: 'password123',
                    displayname: '<script>alert(1)</script>'
                });
            if (res.status !== 400 || !res.body.error) {
                console.log('DEBUG FAILURE:', res.status, res.body, res.text);
            }
            expect(res.status).toBe(400); // Expect Validation Error
            expect(res.body.error).toMatch(/Validation Error/);
        });

        it('should reject missing password', async () => {
            const res = await request(app)
                .post('/api/admin/workers')
                .send({
                    username: 'testworker',
                    displayname: 'Worker'
                });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/admin/leaves', () => {
        it('should reject invalid dates', async () => {
            const res = await request(app)
                .post('/api/admin/leaves')
                .send({
                    start_date: 'not-a-date',
                    end_date: '2025-01-01'
                });
            expect(res.status).toBe(400);
        });

        it('should reject dangerous chars in note', async () => {
            const res = await request(app)
                .post('/api/admin/leaves')
                .send({
                    start_date: '2025-01-01',
                    end_date: '2025-01-02',
                    note: 'DROP TABLE appointments;'
                });
            // Note: Standard Zod string might allow this unless we refine it.
            // For this TDD, let's assume we want to sanitise/reject special SQL chars if strictly requested.
            // Or simpler: just ensure it's a string, max length. 
            // The user asked "secure inputs", usually blocking sensitive chars is good for "note" fields.
            // Let's implement a "safeString" schema that bans < > and ;
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should reject non-string username', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 12345,
                    password: 'password'
                });
            expect(res.status).toBe(400);
        });
    });

    // Portfolio and Settings are multipart/form-data, harder to test with simple JSON middleware
    // but the schemas should still be applied to req.body if we put validate() after multer.
});
