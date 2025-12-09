const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/')
    },
    filename: function (req, file, cb) {
        // Force filename based on fieldname (hero-bg or service-x)
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + ext); // e.g. hero-bg.jpg
    }
});
const upload = multer({ storage: storage });

// Basic Auth Middleware
const basicAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication required');
    }

    const auth = new Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === 'admin' && pass === 'password123') { // Hardcoded for demo
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Access denied');
    }
};

// --- Socket.io ---
io.on('connection', (socket) => {
    console.log('A user connected');
});

const broadcastUpdate = (type, data) => {
    io.emit(type, data);
};

// API Routes

// --- Admin Routes ---

app.get('/api/admin/appointments', basicAuth, (req, res) => {
    try {
        // Privacy: Clean up old phones before showing list
        db.anonymizePastAppointments();
        const appointments = db.getAllAppointments();
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/appointments/:id', basicAuth, (req, res) => {
    try {
        db.deleteAppointment(req.params.id);
        broadcastUpdate('appointment_updated');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/appointments/:id', basicAuth, (req, res) => {
    const { time } = req.body;
    try {
        // Simple conflict check
        // In a real app we'd fetch the date of this appt first
        // For v1 we trust the client or just check if that slot is free on that date
        // But here we only have ID and new Time. 
        // Let's assume the admin checked availability visually or we rely on DB uniqueness constraint.

        db.updateAppointment(req.params.id, time);
        broadcastUpdate('appointment_updated');
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            res.status(409).json({ error: 'Slot already taken' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/api/admin/settings', basicAuth, (req, res) => {
    const { openingHours, holidays } = req.body;
    try {
        if (openingHours) db.setSetting('openingHours', openingHours);
        if (holidays) db.setSetting('holidays', holidays);
        broadcastUpdate('settings_updated');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/settings', basicAuth, (req, res) => {
    try {
        const openingHours = db.getSetting('openingHours') || { start: '09:00', end: '18:00', closedDays: [] };
        const holidays = db.getSetting('holidays') || [];
        res.json({ openingHours, holidays });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/upload', basicAuth, upload.any(), (req, res) => {
    // Files are uploaded by multer. We just return success.
    // In a real app we might validate resizing etc.
    broadcastUpdate('content_updated');
    res.json({ success: true, files: req.files });
});


// --- Public Routes ---

// Get available slots for a date (Respects Settings)
app.get('/api/slots', (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    // 1. Check Settings
    const openingHours = db.getSetting('openingHours') || { start: '09:00', end: '18:00', closedDays: [] }; // Default
    const holidays = db.getSetting('holidays') || [];

    // Check if Holiday
    if (holidays.includes(date)) {
        return res.json([]); // No slots
    }

    // Check if Closed Day (0=Sun, 1=Mon, etc)
    const dayOfWeek = new Date(date).getDay();
    if (openingHours.closedDays && openingHours.closedDays.includes(dayOfWeek)) {
        return res.json([]); // Closed today
    }

    // 2. Generate Slots based on Start/End
    const timeSlots = [];
    let current = parseInt(openingHours.start.split(':')[0]);
    const end = parseInt(openingHours.end.split(':')[0]);

    for (let h = current; h < end; h++) {
        timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    }

    // 3. Get booked slots from DB
    const booked = db.getBookingsForDate(date);
    const bookedTimes = booked.map(b => b.time);

    // Filter available
    const available = timeSlots.map(time => ({
        time,
        isAvailable: !bookedTimes.includes(time)
    }));

    res.json(available);
});

// Book a slot
app.post('/api/book', (req, res) => {
    const { name, date, time, service, phone } = req.body;

    // Basic validation
    if (!name || !date || !time || !service) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    // Privacy/Validation: Simulate SMS
    if (phone) console.log(`[SMS MOCK] Sending validation code to ${phone} for appointment on ${date} at ${time}`);

    try {
        const result = db.createBooking(name, date, time, service, phone);
        broadcastUpdate('appointment_updated');
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            res.status(409).json({ error: 'Slot already booked' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
