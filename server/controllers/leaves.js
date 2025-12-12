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
    const { start, end, adminId, note } = req.body;
    if (!start || !end) {
        return res.status(400).json({ error: 'Start and End dates are required' });
    }

    try {
        // adminId might be provided or null (for Global)
        // Ensure adminId is treated as null if it's an empty string or 'null' string
        let targetAdminId = adminId;
        if (targetAdminId === '' || targetAdminId === 'null') targetAdminId = null;

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
