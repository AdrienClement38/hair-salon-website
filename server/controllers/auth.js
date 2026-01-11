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
            res.status(401).json({ error: 'Identifiants incorrects' });
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
    const { newPassword, displayName, username } = req.body;
    // req.user is set by checkAuth middleware
    const currentUser = req.user ? req.user.username : null;

    console.log('Update Profile Request:', { currentUser, body: req.body });

    try {
        console.log('Update Profile Request:', { currentUser, body: req.body });
        const admin = await db.getAdmin(currentUser);
        if (!admin) return res.status(404).json({ error: 'User not found' });

        if (newPassword) {
            const newHash = await bcrypt.hash(newPassword, 10);
            await db.updateAdminPassword(admin.id, newHash);
        }

        if (req.body.daysOff) {
            const { sendEmails, forceDelete } = req.body;

            if (sendEmails || forceDelete) {
                const conflicts = await db.checkDaysOffConflicts(admin.id, req.body.daysOff);
                // Ensure emailService is available (module scope or require)
                const emailServiceLib = require('../services/emailService');

                for (const appt of conflicts) {
                    if (sendEmails && appt.email) {
                        const wName = displayName || admin.display_name || admin.username;
                        try {
                            await emailServiceLib.sendCancellation(appt, {
                                reason: 'Modification des horaires hebdomadaires',
                                workerName: wName
                            });
                            console.log(`Cancelled appointment ${appt.id} for ${appt.email}`);
                        } catch (emailErr) {
                            console.error(`Failed to send email to ${appt.email}:`, emailErr);
                        }
                    }
                    // Force delete
                    await db.deleteAppointment(appt.id);
                }
            }

            await db.updateAdminDaysOff(admin.id, req.body.daysOff);
        }

        if (displayName || username) {
            // New signature requires both if available, or just displayName
            // If username is passed, we check if it's unique? DB constraint will fail if not unique. Wrapper try/catch handles it.
            await db.updateAdminProfile(admin.id, displayName || admin.display_name, username);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const crypto = require('crypto');
const emailService = require('../services/emailService');

exports.requestPasswordReset = async (req, res) => {
    try {
        // New Flow: No username required to initiate.
        // We send to the salon's configured email regardless.

        // 1. Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        // 2. Save token (Unbound: admin_id = 0)
        await db.createResetToken(token, 0, expiresAt);

        // 3. Get salon email config to send TO the salon (assuming admin reads salon emails)
        // Actually, earlier assumption was we send to the salon's OWN email address from Settings.
        let emailConfig = await db.getSetting('email_config');
        if (!emailConfig) {
            // Start of loop to generate failure if no config? 
            // For security/UX, we might plain succeed or warn.
            // Let's return success but log warning.
            console.warn('Password Reset requested but no email config found.');
            return res.json({ success: true, message: 'Si une configuration email existe, le lien a été envoyé.' });
        }

        // Parse if string
        if (typeof emailConfig === 'string') {
            try { emailConfig = JSON.parse(emailConfig); } catch (e) { }
        }

        if (!emailConfig || !emailConfig.user) {
            console.warn('Password Reset requested but user email missing in config.');
            return res.json({ success: true, message: 'Si une configuration email existe, le lien a été envoyé.' });
        }

        // 4. Send Email
        // The recipient is the salon itself (emailConfig.user) as per previous context
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
        await emailService.sendPasswordReset(emailConfig.user, resetLink);

        res.json({ success: true, message: 'Si le service est configuré, un email a été envoyé.' });

    } catch (error) {
        console.error('Request Password Reset Error:', error);
        res.status(500).json({ success: false, error: 'Une erreur est survenue.' });
    }
};

exports.verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;
        const resetToken = await db.getResetToken(token);

        if (!resetToken) {
            return res.status(404).json({ valid: false, message: 'Lien invalide ou expiré.' });
        }

        // Check expiration
        const now = new Date();
        const expires = new Date(resetToken.expires_at); // Ensure Date object

        if (now > expires) {
            await db.deleteResetToken(token); // Cleanup
            return res.status(400).json({ valid: false, message: 'Lien expiré.' });
        }

        res.json({ valid: true });

    } catch (error) {
        console.error('Verify Token Error:', error);
        res.status(500).json({ valid: false, error: 'Erreur serveur.' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword, username } = req.body;

        if (!token || !newPassword || !username) {
            return res.status(400).json({ success: false, error: 'Tous les champs sont requis.' });
        }

        // 1. Verify token again
        const resetToken = await db.getResetToken(token);
        if (!resetToken) {
            return res.status(400).json({ success: false, error: 'Token invalide.' });
        }

        // 2. Find Admin by Username (Strict)
        const targetAdmin = await db.getAdmin(username);

        if (!targetAdmin) {
            return res.status(404).json({ success: false, error: "L'utilisateur n'existe pas." });
        }

        // 3. Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 4. Update Password
        await db.updateAdminPassword(targetAdmin.id, hashedPassword);

        // 5. Delete Token
        await db.deleteResetToken(token);

        res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur.' });
    }
};
