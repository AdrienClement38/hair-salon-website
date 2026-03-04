const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');
const socketService = require('../services/socketService'); // IMPORT SOCKET SERVICE
const path = require('path');
const fs = require('fs'); // AJOUT DE L'IMPORT MANQUANT POUR FILE SYSTEM

exports.update = async (req, res) => {
    const { openingHours, holidays, holidayRanges, home_content, services, contact_info, products, email_config, salon_identity } = req.body;

    try {
        if (openingHours) await db.setSetting('opening_hours', openingHours);
        if (holidays) await db.setSetting('holidays', holidays);
        if (holidayRanges) await db.setSetting('holidayRanges', holidayRanges);
        if (home_content) await db.setSetting('home_content', home_content);
        if (services) await db.setSetting('services', services);
        if (services) await db.setSetting('services', services);
        if (contact_info) await db.setSetting('contact_info', contact_info);

        if (email_config !== undefined) {
            // Smart Merge for Password Security
            if (email_config && !email_config.pass) {
                const oldConfig = await db.getSetting('email_config');
                if (oldConfig && oldConfig.pass) {
                    email_config.pass = oldConfig.pass;
                }
            }
            await db.setSetting('email_config', email_config);
        }

        if (salon_identity) await db.setSetting('salon_identity', salon_identity);
        if (products) {
            // Check for orphan images before saving new list
            const oldProducts = (await db.getSetting('products')) || [];
            const oldImages = oldProducts.filter(p => p.image).map(p => p.image);

            // New images
            const newImages = products.filter(p => p.image).map(p => p.image);

            // Find images that were in OLD but NOT in NEW
            const orphans = oldImages.filter(img => !newImages.includes(img));



            if (orphans.length > 0) {
                console.log('Cleaning up orphan product images:', orphans);
                await Promise.all(orphans.map(img => db.deleteImage(img)));
            }

            await db.setSetting('products', products);
        }

        triggerUpdate('settings');
        try {
            socketService.getIO().emit('settingsUpdated');
        } catch (e) { console.error('Socket emit error:', e); }

        res.json({ success: true });
    } catch (err) {
        console.error('Settings Update Error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.testEmail = async (req, res) => {
    let { user, pass, host, port } = req.body;

    // Merge stored pass if missing (for testing saved config)
    if (!pass && user) {
        try {
            const oldConfig = await db.getSetting('email_config');
            if (oldConfig && oldConfig.pass) {
                pass = oldConfig.pass;
            }
        } catch (e) { }
    }

    try {
        const emailService = require('../services/emailService');
        await emailService.testConnection({ user, pass, host, port });
        res.json({ success: true });
    } catch (err) {
        console.error("Email Test Failed:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.get = async (req, res) => {
    try {
        const openingHours = (await db.getSetting('opening_hours')) || { start: '09:00', end: '18:00', closedDays: [] };
        const holidays = (await db.getSetting('holidays')) || [];
        const globalLeaves = await db.getLeaves(null);
        const holidayRanges = globalLeaves.map(l => ({ start: l.start_date, end: l.end_date }));
        const home_content = (await db.getSetting('home_content')) || {};
        const services = (await db.getSetting('services')) || [];
        const contact_info = (await db.getSetting('contact_info')) || { address: '', phone: '' };
        const products = (await db.getSetting('products')) || [];
        const salon_identity = (await db.getSetting('salon_identity')) || { name: 'La Base Coiffure', logo: null };

        const fullEmailConfig = (await db.getSetting('email_config'));
        let email_config = fullEmailConfig;

        // Security: If not authenticated as Admin, DO NOT return sensitive email config.
        // Instead, return a flag indicating if it is configured.
        if (!req.user) {
            const isConfigured = !!(fullEmailConfig && fullEmailConfig.user && fullEmailConfig.host);
            email_config = null; // Strip sensitive data
            // Add flag to response (top level or separate)
            // We'll add it to the JSON response
            res.json({
                openingHours,
                holidays,
                holidayRanges,
                home_content,
                services,
                contact_info,
                products,
                salon_identity,
                // Public Safe Flag
                emailConfigured: isConfigured
            });
            return;
        }

        // Admin gets the full config
        res.json({ openingHours, holidays, holidayRanges, home_content, services, contact_info, products, email_config, salon_identity });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.uploadImages = async (req, res) => {
    try {
        const files = req.files ? Object.values(req.files).flat() : [];
        console.log('Uploading images:', files.map(f => f.fieldname));
        const promises = files.map(async file => {
            // Save using the specific field name as ID (e.g. 'hero-bg'), ignoring extension
            // Mime type is saved in DB so serving works correctly.
            const filename = file.fieldname;
            await db.saveImage(filename, file.buffer, file.mimetype);

            // Special handling for salon-logo: update the identity setting
            if (filename === 'salon-logo') {
                const identity = (await db.getSetting('salon_identity')) || { name: 'La Base Coiffure' };
                identity.logo = filename;
                await db.setSetting('salon_identity', identity);
            }
        });

        await Promise.all(promises);
        triggerUpdate('settings');
        res.json({ success: true, files: req.files.map(f => f.fieldname) });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
};

exports.serveImage = async (req, res) => {
    try {
        const filename = req.params.filename;
        const rootImagesPath = path.join(__dirname, '../../public/images');

        console.log(`Demande d'image reçue: ${filename}`);

        if (res.headersSent) return;

        // Anti-directory traversal security
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).send('Invalid filename');
        }

        const tryServe = (dirPath) => {
            return new Promise((resolve) => {
                // Try exact filename first (it might have the extension from extraction)
                const exactPath = path.join(dirPath, filename);
                if (fs.existsSync(exactPath)) {
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    res.sendFile(exactPath);
                    resolve(true);
                    return;
                }

                // Try adding common extensions if missing
                const extensions = ['.jpg', '.png', '.webp', '.jpeg'];
                for (const ext of extensions) {
                    const pathWithExt = path.join(dirPath, filename + ext);
                    if (fs.existsSync(pathWithExt)) {
                        res.setHeader('Cache-Control', 'public, max-age=86400');
                        res.sendFile(pathWithExt);
                        resolve(true);
                        return;
                    }
                }
                resolve(false);
            });
        };

        // Chercher à la racine des images (fichiers originaux existants)
        const foundInRoot = await tryServe(rootImagesPath);
        if (foundInRoot) return;

        // 3. Essayer la BDD (Legacy, si on n'a pas migré)
        const image = await db.getImage(filename);
        if (image && image.data && image.data.length > 0) {
            console.log(`Serving image from DB (Legacy): ${filename} (${image.mimetype})`);
            res.setHeader('Content-Type', image.mimetype);
            res.setHeader('Cache-Control', 'no-cache');
            res.send(image.data);
            return;
        }

        console.warn(`File not found anywhere: ${filename}`);
        if (!res.headersSent) {
            res.status(404).send('Not Found');
        }

    } catch (err) {
        console.error("Serve image error:", err);
        if (!res.headersSent) {
            res.status(404).send('Not Found');
        }
    }
};
