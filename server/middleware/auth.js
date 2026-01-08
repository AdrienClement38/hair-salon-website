const db = require('../models/database');
const bcrypt = require('bcryptjs');

const checkAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    try {
        const admin = await db.getAdmin(user);
        if (admin && await bcrypt.compare(pass, admin.password_hash)) {
            req.user = admin; // Attach user to req for convenience
            next();
        } else {
            // Fake delay to prevent timing attacks equivalent
            await new Promise(resolve => setTimeout(resolve, 100));
            return res.status(401).send('Access denied');
        }
    } catch (e) {
        console.error('Auth error:', e);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = checkAuth;
