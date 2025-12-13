const db = require('../models/database');
const bcrypt = require('bcryptjs');

exports.status = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const exists = await db.checkAdminExists();
        // list env keys relevant to DB to check presence
        const envKeys = Object.keys(process.env).filter(k => k.includes('URL') || k.includes('POSTGRES') || k.includes('DATABASE') || k === 'VERCEL');

        res.json({
            setupRequired: !exists,
            debug: {
                type: db.type,
                envVarsFound: envKeys
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.setup = async (req, res) => {
    try {
        const exists = await db.checkAdminExists();
        if (exists) {
            return res.status(403).json({ error: 'Admin already exists' });
        }

        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

        const hash = await bcrypt.hash(password, 10);
        await db.createAdmin(username, hash);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await db.getAdmin(username);
        if (admin && await bcrypt.compare(password, admin.password_hash)) {
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.me = async (req, res) => {
    // req.user logic could be used here if middleware set it, but basic auth header parsing is usually robust enough or done in middleware
    const authHeader = req.headers.authorization;
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    try {
        const admin = await db.getAdmin(user);
        if (!admin) return res.status(404).json({ error: 'Not found' });
        res.json({
            id: admin.id,
            username: admin.username,
            displayName: admin.display_name || admin.username
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.updateProfile = async (req, res) => {
    const { newPassword, displayName } = req.body;
    const authHeader = req.headers.authorization;
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const currentUser = auth[0];

    try {
        const admin = await db.getAdmin(currentUser);
        if (!admin) return res.status(404).json({ error: 'User not found' });

        if (newPassword) {
            const newHash = await bcrypt.hash(newPassword, 10);
            await db.updateAdminPassword(admin.id, newHash);
        }

        if (displayName) {
            await db.updateAdminProfile(admin.id, displayName);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
