const db = require('../models/database');
const bcrypt = require('bcryptjs');

exports.listWorkers = async (req, res) => {
    try {
        const admins = await db.getAllAdmins();
        // Normalize snake_case to camelCase for frontend consistency
        const mapped = admins.map(a => ({
            id: a.id,
            username: a.username,
            displayName: a.display_name,
            daysOff: a.days_off || [] // Ensure it exists
        }));
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.createWorker = async (req, res) => {
    const { username, password, displayName, daysOff } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hash = await bcrypt.hash(password, 10);
        await db.createAdmin(username, hash, displayName, daysOff);
        // Trigger update for public clients
        const polling = require('../config/polling');
        polling.triggerUpdate('settings');

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.listPublicWorkers = async (req, res) => {
    try {
        // console.log("Public Workers Request");
        const workers = await db.getAllAdmins();
        const today = new Date().toISOString().split('T')[0];

        const safeWorkers = await Promise.all(workers.map(async w => {
            // Fetch leaves (Strict = true, only this worker)
            const leaves = await db.getLeaves(w.id, true);

            // Filter future or current leaves
            const futureLeaves = leaves
                .filter(l => l.end_date >= today)
                .map(l => ({
                    start_date: l.start_date,
                    end_date: l.end_date
                }));

            return {
                id: w.id,
                name: w.display_name || w.username,
                daysOff: w.days_off,
                leaves: futureLeaves
            };
        }));

        res.json(safeWorkers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};


const polling = require('../config/polling');

exports.updateWorker = async (req, res) => {
    const { id } = req.params;
    const { password, displayName, daysOff, username, sendEmails, forceDelete } = req.body;

    try {
        const admin = await db.getAdminById(id);
        if (!admin) return res.status(404).json({ error: 'Worker not found' });

        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await db.updateAdminPassword(id, hash);
        }

        if (displayName || username) {
            await db.updateAdminProfile(id, displayName || admin.display_name, username);
        }

        if (daysOff) {
            // Check conflicts if email requested OR valid force delete implied
            if (sendEmails || forceDelete) {
                const conflicts = await db.checkDaysOffConflicts(id, daysOff);
                const emailService = require('../services/emailService');
                for (const appt of conflicts) {
                    // Send Email if applicable
                    if (sendEmails && appt.email) {
                        // We need worker name for context, admin.display_name might be old if updated above?
                        // Use displayName if provided, else admin.display_name
                        const wName = displayName || admin.display_name;
                        try {
                            await emailService.sendCancellation(appt, {
                                reason: 'Modification des horaires hebdomadaires',
                                workerName: wName
                            });
                            console.log(`Cancelled appointment ${appt.id} for ${appt.email}`);
                        } catch (emailErr) {
                            console.error(`Failed to send email to ${appt.email}:`, emailErr);
                        }
                    }
                    // Always delete if we are in this block (confirmed action)
                    await db.deleteAppointment(appt.id);
                }
            }
            await db.updateAdminDaysOff(id, daysOff);
        }

        if (displayName || daysOff) {
            polling.triggerUpdate('settings'); // Trigger public update
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Update Worker Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.deleteWorker = async (req, res) => {
    const { id } = req.params;
    try {
        const admin = await db.getAdminById(id);
        if (!admin) return res.status(404).json({ error: 'Worker not found' });

        // Prevent self-deletion if that was somehow requested via ID (though UI protects it)
        // Ideally we check if it's the main admin, but checking if req.user.id === id is good practice
        if (req.user && req.user.id == id) {
            return res.status(403).json({ error: 'Cannot delete yourself' });
        }

        await db.deleteAdmin(admin.username);

        polling.triggerUpdate('settings');

        res.json({ success: true });
    } catch (e) {
        console.error("Delete Worker Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.checkDaysOff = async (req, res) => {
    try {
        const { adminId, daysOff } = req.body;
        // adminId might be null or string "null" if creating new worker? 
        // If creating new worker, adminId may be undefined, but we can't check conflicts for a new worker easily unless we check "All" but that doesn't make sense.
        // Actually, for NEW worker, they have no appointments yet, so no conflicts possible.
        // This is only relevant for UPDATING existing worker.

        if (!adminId) return res.json([]); // No existing appointments to conflict with

        // daysOff is array of integers
        const conflicts = await db.checkDaysOffConflicts(adminId, daysOff);
        res.json(conflicts);
    } catch (e) {
        console.error("Check Days Off Error:", e);
        res.status(500).json({ error: e.message });
    }
};
