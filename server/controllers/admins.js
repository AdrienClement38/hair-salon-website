const db = require('../models/database');
const bcrypt = require('bcryptjs');

exports.listWorkers = async (req, res) => {
    try {
        const admins = await db.getAllAdmins();
        res.json(admins);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.createWorker = async (req, res) => {
    const { username, password, displayName } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hash = await bcrypt.hash(password, 10);
        await db.createAdmin(username, hash, displayName);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.listPublicWorkers = async (req, res) => {
    try {
        const workers = await db.getAllAdmins();
        const safeWorkers = workers.map(w => ({ id: w.id, name: w.display_name || w.username }));
        res.json(safeWorkers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
