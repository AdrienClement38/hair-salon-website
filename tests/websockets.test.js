const request = require('supertest');
const app = require('../index');
const http = require('http');
const socketService = require('../server/services/socketService');
const db = require('../server/models/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lbc-secret-key-2024';

describe('WebSocket Emissions', () => {
    let clientSocket;
    let adminToken;
    let port;
    let testServer;

    beforeAll(async () => {
        await db.initPromise;

        // Create an admin user for testing
        const hashedPassword = await require('bcryptjs').hash('testpass', 10);
        await db.run(
            'INSERT OR IGNORE INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)',
            ['testadmin', hashedPassword, 'Test Admin']
        );

        const admin = await db.getAdminByUsername('testadmin');
        adminToken = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1h' });

        testServer = http.createServer(app);
        socketService.init(testServer);

        await new Promise(resolve => testServer.listen(0, '127.0.0.1', resolve));

        port = testServer.address().port;
    });

    afterAll(async () => {
        if (testServer && testServer.listening) {
            await new Promise(resolve => testServer.close(resolve));
        }
    });

    beforeEach((done) => {
        clientSocket = require('socket.io-client')(`http://127.0.0.1:${port}`);
        clientSocket.on('connect', done);
    });

    afterEach(() => {
        if (clientSocket && clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    test('should emit appointmentsUpdated when an appointment is booked', (done) => {
        // Wait for the event
        clientSocket.on('appointmentsUpdated', () => {
            expect(true).toBe(true);
            done();
        });

        // Trigger the booking
        request(app)
            .post('/api/book')
            .send({
                name: 'Test Setup',
                email: 'test@example.com',
                phone: '0612345678',
                service: 'Coupe',
                date: '2025-10-10',
                time: '10:00'
            })
            .expect(200)
            .end((err) => {
                if (err) done(err);
            });
    });
});
