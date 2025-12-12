const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');

exports.list = async (req, res) => {
    const { adminId } = req.query;
    try {
        await db.anonymizePastAppointments();
        const appointments = await db.getAllAppointments(adminId);
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await db.deleteAppointment(req.params.id);
        triggerUpdate();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.update = async (req, res) => {
    const { time } = req.body;
    try {
        await db.updateAppointment(req.params.id, time);
        triggerUpdate();
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key')) {
            res.status(409).json({ error: 'Slot already taken' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
};

exports.createBooking = async (req, res) => {
    const { name, date, time, service, phone, adminId } = req.body;

    if (!name || !date || !time || !service) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    // Manual check to prevent duplicates (handles SQLite NULL behavior)
    try {
        const booked = await db.getBookingsForDate(date, adminId);
        if (booked.some(b => b.time === time)) {
            return res.status(409).json({ error: 'Slot already booked' });
        }
    } catch (e) {
        console.error("Check slot error", e);
        // Continue to try insert if check fails? Or fail? Safe to fail.
        return res.status(500).json({ error: 'Error checking availability' });
    }

    try {
        const result = await db.createBooking(name, date, time, service, phone, adminId);
        triggerUpdate();
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key')) {
            res.status(409).json({ error: 'Slot already booked' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
};

exports.getSlots = async (req, res) => {
    const { date, adminId } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    try {
        let openingHours = await db.getSetting('openingHours');
        const holidays = (await db.getSetting('holidays')) || [];
        const holidayRanges = (await db.getSetting('holidayRanges')) || [];

        if (holidays.includes(date)) {
            return res.json([]);
        }

        const checkDate = new Date(date);
        for (const range of holidayRanges) {
            const start = new Date(range.start);
            const end = new Date(range.end);
            if (checkDate >= start && checkDate <= end) {
                return res.json([]);
            }
        }

        const dayOfWeek = new Date(date).getDay();

        let daySettings = null;

        if (Array.isArray(openingHours)) {
            daySettings = openingHours[dayOfWeek];
        } else {
            openingHours = openingHours || { start: '09:00', end: '18:00', closedDays: [] };
            const isClosed = openingHours.closedDays && openingHours.closedDays.includes(dayOfWeek);
            daySettings = {
                isOpen: !isClosed,
                open: openingHours.start,
                close: openingHours.end
            };
        }

        if (!daySettings || !daySettings.isOpen) {
            return res.json([]);
        }

        const timeSlots = [];
        let current = parseInt(daySettings.open.split(':')[0]);
        const end = parseInt(daySettings.close.split(':')[0]);

        if (isNaN(current) || isNaN(end)) return res.json([]);

        for (let h = current; h < end; h++) {
            timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
        }

        const booked = await db.getBookingsForDate(date, adminId);
        const bookedTimes = booked.map(b => b.time);

        const available = timeSlots.map(time => ({
            time,
            isAvailable: !bookedTimes.includes(time)
        }));

        res.json(available);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
