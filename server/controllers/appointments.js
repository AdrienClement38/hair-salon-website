const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');
const appointmentService = require('../services/appointmentService');

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
    try {
        // Validation now handled by middleware
        const result = await appointmentService.createBooking(req.body);
        triggerUpdate();
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.message === 'Slot already booked') {
            return res.status(409).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};

exports.getSlots = async (req, res) => {
    const { date, adminId } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    try {
        const slots = await appointmentService.getAvailableSlots(date, adminId);
        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
