const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');
const appointmentService = require('../services/appointmentService');
const waitingListService = require('../services/waitingListService');

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
        const { sendEmail } = req.body; // Check flag from frontend
        const id = req.params.id;

        if (sendEmail) {
            const appt = await db.getAppointmentById(id);
            if (appt && appt.email) {
                const emailService = require('../services/emailService');
                // Resolve worker name for the email template
                let workerName = 'Le Coiffeur';
                if (appt.admin_id) {
                    const admin = await db.getAdminById(appt.admin_id);
                    if (admin) workerName = admin.display_name || admin.username;
                }

                try {
                    await emailService.sendCancellation(appt, {
                        reason: 'Annulation manuelle par le salon',
                        workerName: workerName
                    });
                    console.log(`Manual cancellation email sent to ${appt.email}`);
                } catch (emailErr) {
                    console.error("Failed to send manual cancellation email:", emailErr);
                    // Continue with deletion even if email fails
                }
            }
        }

        // WAITING LIST HOOK
        // We need the details of the deleted appt BEFORE deletion to know Date/Time/Service(for duration).
        // appt is fetched above ONLY if sendEmail is true.
        // We need it always if we want to trigger waitlist.
        let deletedAppt = null;
        if (!req.body.sendEmail) { // If sendEmail was false, we didn't fetch it yet
            // Try to fetch (if id is valid). If it doesn't exist, delete will create no error but 0 changes.
            // Best effort.
            deletedAppt = await db.getAppointmentById(id);
        } else {
            // We already fetched (or tried) in 'appt' local var but it is scoped in if block.
            // Actually, the previous block scopes 'const appt'. We can't access it here.
            // Let's refactor slightly to fetch once.
        }

        // Wait, let's just re-fetch or assume 'appt' variable scope issue.
        // Let's rely on a helper to get details.
        if (!deletedAppt) deletedAppt = await db.getAppointmentById(id);

        await db.deleteAppointment(id);

        // Trigger Waitlist Matcher (Async, don't block response)
        if (deletedAppt) {
            // Calculate Duration of freed slot.
            // We have service Name. We need duration.
            // Service handles that.
            // We assume standard slot opening.

            // Get services to find duration of THIS specific service name to know how much time is freed?
            // Actually AppointmentService / WaitingListService processes that.
            // We just pass the freed time.

            // Issue: 'service' in DB is a string Name.
            // We need to look up duration.
            const services = await db.getSetting('services') || [];
            const s = services.find(srv => srv.name === deletedAppt.service);
            const duration = s ? s.duration : 30;

            await waitingListService.processCancellation(deletedAppt.date, deletedAppt.time, duration, deletedAppt.admin_id);
        }

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
        // Pass email if present
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
