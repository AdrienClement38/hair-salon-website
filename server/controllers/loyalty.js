const db = require('../models/database');

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
