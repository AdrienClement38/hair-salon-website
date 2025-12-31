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

        // Send Email Confirmation (Fire and Forget)
        const emailService = require('../services/emailService');
        // We need the worker's name. createBooking returns ID.
        // req.body has adminId, service, date, time, name.
        // We need to resolve worker name if possible, or pass adminId for the service to look up?
        // emailService.sendConfirmation expects workerName.
        // Let's look it up quickly or pass what we have.
        // Ideally AppointmentService returns the enriched booking or we duplicate logic.
        // Simplest: Fetch worker name here or let EmailService handle it?
        // EmailService generates HTML, so it needs the name. 
        // Let's just fetch it here or modify req.body if it came from frontend (it usually doesn't send worker NAME, just ID).
        // Actually, let's fetch the admin to get the display name.
        const db = require('../models/database');
        let workerName = 'Le Coiffeur';
        if (req.body.adminId) {
            const admin = await db.getAdminById(req.body.adminId);
            if (admin) workerName = admin.display_name || admin.username;
        }

        emailService.sendConfirmation({
            ...req.body,
            to: req.body.email,
            workerName
        }).catch(err => console.error("Email send failed", err));

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
    const { date, adminId, serviceId } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    try {
        const slots = await appointmentService.getAvailableSlots(date, adminId, serviceId);
        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
