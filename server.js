const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const http = require('http');
const db = require('./database');

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Basic Auth Middleware
const basicAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === 'admin' && pass === 'password123') { // Hardcoded for demo
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Access denied');
    }
};

// --- Polling System ---
let lastUpdate = Date.now();

const triggerUpdate = () => {
    lastUpdate = Date.now();
};

app.get('/api/updates', (req, res) => {
    const clientTimestamp = parseInt(req.query.lastTimestamp) || 0;
    res.json({
        needsUpdate: lastUpdate > clientTimestamp,
        currentTimestamp: lastUpdate
    });
});


// API Routes

// Serve Admin Page
app.get('/admin', (req, res) => {
    res.sendFile('admin.html', { root: path.join(__dirname, 'public') });
});

// --- Image Serving ---
app.get('/images/:filename', async (req, res) => {
    try {
        const image = await db.getImage(req.params.filename);
        if (image) {
            res.setHeader('Content-Type', image.mimetype);
            res.send(image.data);
        } else {
            // Try fallback to local file if not in DB (for migration phase or default assets)
            res.sendFile(req.params.filename, { root: path.join(__dirname, 'public') }, (err) => {
                if (err) res.status(404).send('Not Found');
            });
        }
    } catch (err) {
        console.error(err);
        res.status(404).send('Not Found');
    }
});


// --- Admin Routes ---

app.get('/api/admin/appointments', basicAuth, async (req, res) => {
    try {
        await db.anonymizePastAppointments();
        const appointments = await db.getAllAppointments();
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/appointments/:id', basicAuth, async (req, res) => {
    try {
        await db.deleteAppointment(req.params.id);
        triggerUpdate();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/appointments/:id', basicAuth, async (req, res) => {
    const { time } = req.body;
    try {
        await db.updateAppointment(req.params.id, time);
        triggerUpdate();
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key')) { // Postgres & SQLite check
            res.status(409).json({ error: 'Slot already taken' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/api/admin/settings', basicAuth, async (req, res) => {
    const { openingHours, holidays, holidayRanges } = req.body;
    try {
        if (openingHours) await db.setSetting('openingHours', openingHours);
        if (holidays) await db.setSetting('holidays', holidays);
        if (holidayRanges) await db.setSetting('holidayRanges', holidayRanges);
        triggerUpdate();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/settings', basicAuth, async (req, res) => {
    try {
        const openingHours = (await db.getSetting('openingHours')) || { start: '09:00', end: '18:00', closedDays: [] };
        const holidays = (await db.getSetting('holidays')) || [];
        const holidayRanges = (await db.getSetting('holidayRanges')) || [];
        res.json({ openingHours, holidays, holidayRanges });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/upload', basicAuth, upload.any(), async (req, res) => {
    try {
        const promises = req.files.map(file => {
            // Force filename based on fieldname
            const ext = path.extname(file.originalname);
            const filename = file.fieldname + ext;
            return db.saveImage(filename, file.buffer, file.mimetype);
        });

        await Promise.all(promises);
        triggerUpdate();
        res.json({ success: true, files: req.files.map(f => f.fieldname) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});


// --- Public Routes ---

// Public Settings Endpoint
app.get('/api/settings', async (req, res) => {
    try {
        const openingHours = (await db.getSetting('openingHours')) || { start: '09:00', end: '18:00', closedDays: [] };
        const holidays = (await db.getSetting('holidays')) || [];
        res.json({ openingHours, holidays });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get available slots for a date (Respects Settings)
app.get('/api/slots', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    try {
        // 1. Check Settings
        let openingHours = await db.getSetting('openingHours');
        const holidays = (await db.getSetting('holidays')) || [];

        // Check if Holiday
        if (holidays.includes(date)) {
            return res.json([]); // No slots
        }

        const dayOfWeek = new Date(date).getDay(); // 0 is Sunday

        // Normalize openingHours to new Array format if it's old object
        let daySettings = null;

        if (Array.isArray(openingHours)) {
            daySettings = openingHours[dayOfWeek];
        } else {
            // Fallback or Old Format
            openingHours = openingHours || { start: '09:00', end: '18:00', closedDays: [] };
            const isClosed = openingHours.closedDays && openingHours.closedDays.includes(dayOfWeek);
            daySettings = {
                isOpen: !isClosed,
                open: openingHours.start,
                close: openingHours.end
            };
        }

        if (!daySettings || !daySettings.isOpen) {
            return res.json([]); // Closed today
        }

        // 2. Generate Slots based on Day's Start/End
        const timeSlots = [];
        let current = parseInt(daySettings.open.split(':')[0]);
        const end = parseInt(daySettings.close.split(':')[0]);

        // Robust check for invalid times
        if (isNaN(current) || isNaN(end)) return res.json([]);

        for (let h = current; h < end; h++) {
            timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
        }

        // 3. Get booked slots from DB
        const booked = await db.getBookingsForDate(date);
        const bookedTimes = booked.map(b => b.time);

        // Filter available
        const available = timeSlots.map(time => ({
            time,
            isAvailable: !bookedTimes.includes(time)
        }));

        res.json(available);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Book a slot
app.post('/api/book', async (req, res) => {
    const { name, date, time, service, phone } = req.body;

    // Basic validation
    if (!name || !date || !time || !service) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    try {
        const result = await db.createBooking(name, date, time, service, phone);
        triggerUpdate();
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key')) {
            res.status(409).json({ error: 'Slot already booked' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
