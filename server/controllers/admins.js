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
        const safeWorkers = workers.map(w => ({ id: w.id, name: w.display_name || w.username }));
        res.json(safeWorkers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};


const polling = require('../config/polling');

exports.updateWorker = async (req, res) => {
    const { id } = req.params;
    const { password, displayName } = req.body;

    try {
        const admin = await db.getAdminById(id);
        if (!admin) return res.status(404).json({ error: 'Worker not found' });

        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await db.updateAdminPassword(id, hash);
        }

        if (displayName) {
            await db.updateAdminProfile(id, displayName);
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
