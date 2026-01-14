const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');
const path = require('path');

exports.update = async (req, res) => {
    const { openingHours, holidays, holidayRanges, home_content, services, contact_info, products, email_config, salon_identity } = req.body;

    try {
        if (openingHours) await db.setSetting('opening_hours', openingHours);
        if (holidays) await db.setSetting('holidays', holidays);
        if (holidayRanges) await db.setSetting('holidayRanges', holidayRanges);
        if (home_content) await db.setSetting('home_content', home_content);
        if (services) await db.setSetting('services', services);
        if (contact_info) await db.setSetting('contact_info', contact_info);
        if (email_config !== undefined) await db.setSetting('email_config', email_config);
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
        res.json({ success: true });
    } catch (err) {
        console.error('Settings Update Error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.testEmail = async (req, res) => {
    const { user, pass, host, port } = req.body;
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
        const image = await db.getImage(filename);
        if (image) {
            console.log(`Serving image: ${filename} (${image.mimetype})`);

            if (res.headersSent) return;

            res.setHeader('Content-Type', image.mimetype);
            res.setHeader('Cache-Control', 'no-cache'); // Prevent caching issues
            res.send(image.data);
        } else {
            console.warn(`Image not found in DB: ${filename}`);

            if (res.headersSent) return;

            // Try to send a default file if DB is empty, but handling extensions is tricky without DB.
            // For now, if missing in DB, we verify if a static fallback exists using the param as is.
            res.sendFile(filename + '.jpg', { root: path.join(__dirname, '../../public/images') }, (err) => {
                if (err) {
                    console.warn(`Static fallback not found for: ${filename}`);
                    if (!res.headersSent) {
                        res.status(404).send('Not Found');
                    }
                }
            });
        }
    } catch (err) {
        console.error("Serve image error:", err);
        if (!res.headersSent) {
            res.status(404).send('Not Found');
        }
    }
};
