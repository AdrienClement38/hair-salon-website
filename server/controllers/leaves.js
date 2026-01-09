const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');

exports.list = async (req, res) => {
    try {
        // Admin dashboard needs to see all leaves to manage them? 
        // Or if filter provided?
        // Let's return all for the management table.
        const leaves = await db.getAllLeaves();
        res.json(leaves);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.create = async (req, res) => {
    const { start, end, adminId, note, sendEmails, forceDelete } = req.body;
    if (!start || !end) {
        return res.status(400).json({ error: 'Start and End dates are required' });
    }

    try {
        // adminId might be provided or null (for Global)
        let targetAdminId = adminId;
        if (targetAdminId === '' || targetAdminId === 'null') targetAdminId = null;

        // Check for conflicts if we want to send emails OR force delete
        if (sendEmails || forceDelete) {
            const conflicts = await db.checkAppointmentConflicts(start, end, targetAdminId);
            const emailService = require('../services/emailService');

            for (const appt of conflicts) {
                // If appointment has an email AND sendEmails is true, send cancellation
                if (sendEmails && appt.email) {
                    try {
                        await emailService.sendCancellation(appt, {
                            reason: note || (targetAdminId ? 'Congés Coiffeur' : 'Fermeture exceptionnelle')
                        });
                        console.log(`Cancelled appointment ${appt.id} for ${appt.email}`);
                    } catch (emailErr) {
                        console.error(`Failed to send email to ${appt.email}:`, emailErr);
                    }
                }

                // Delete appointment regardless of email presense if forceDelete is true (or implied by sendEmails?)
                // User said: "suppression des rdv se fasse aussi même si le client n'a pas de mail".
                // If we are here, user confirmed action.
                await db.deleteAppointment(appt.id);
            }
        }

        await db.createLeave(start, end, targetAdminId, note);
        triggerUpdate('settings'); // Trigger update for frontend to refresh calendar/settings
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await db.deleteLeave(req.params.id);
        triggerUpdate('settings');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.check = async (req, res) => {
    try {
        const { start, end, adminId } = req.query;
        if (!start || !end) {
            return res.status(400).json({ error: 'Start and End dates are required' });
        }

        // adminId might be "null" string or empty
        let targetAdminId = adminId;
        if (targetAdminId === 'null' || targetAdminId === '') targetAdminId = null;

        const conflicts = await db.checkAppointmentConflicts(start, end, targetAdminId);
        res.json(conflicts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
