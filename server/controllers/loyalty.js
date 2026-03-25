const db = require('../models/database');
const socketService = require('../services/socketService');

exports.getStatus = async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    try {
        const client = await db.getClientByEmail(email.trim());
        if (!client) {
            return res.json({ optedIn: false, points: 0 });
        }
        res.json({
            // Ensure boolean conversion handling DB varying dialects
            optedIn: !!client.opt_in_loyalty,
            points: client.loyalty_points
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.listClients = async (req, res) => {
    try {
        const clients = await db.getAllClients();
        res.json(clients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.adjustPoints = async (req, res) => {
    const { email } = req.params;
    const { delta } = req.body;
    if (delta === undefined) return res.status(400).json({ error: 'Delta required' });

    try {
        const result = await db.adjustClientPoints(email, parseInt(delta));
        // Real-time Update for other admin pages (e.g. Agenda/Badges)
        try {
            socketService.getIO().emit('appointmentsUpdated');
        } catch (err) { console.error('[Socket] Update failed:', err); }
        
        res.json({ success: true, newPoints: result.newPoints });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteClient = async (req, res) => {
    const { email } = req.params;
    try {
        await db.deleteClient(email);
        // Real-time Update for other admin pages
        try {
            socketService.getIO().emit('appointmentsUpdated');
        } catch (err) { console.error('[Socket] Update failed:', err); }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
