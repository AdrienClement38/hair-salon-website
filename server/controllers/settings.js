const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');
const path = require('path');

exports.update = async (req, res) => {
    const { openingHours, holidays, holidayRanges, home_content, services, contact_info, products, email_config } = req.body;

    try {
        if (openingHours) await db.setSetting('openingHours', openingHours);
        if (holidays) await db.setSetting('holidays', holidays);
        if (holidayRanges) await db.setSetting('holidayRanges', holidayRanges);
        if (home_content) await db.setSetting('home_content', home_content);
        if (services) await db.setSetting('services', services);
        if (contact_info) await db.setSetting('contact_info', contact_info);
        if (email_config) await db.setSetting('email_config', email_config);
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
        const openingHours = (await db.getSetting('openingHours')) || { start: '09:00', end: '18:00', closedDays: [] };
        const holidays = (await db.getSetting('holidays')) || [];
        const globalLeaves = await db.getLeaves(null);
        const holidayRanges = globalLeaves.map(l => ({ start: l.start_date, end: l.end_date }));
        const home_content = (await db.getSetting('home_content')) || {};
        const services = (await db.getSetting('services')) || [];
        const contact_info = (await db.getSetting('contact_info')) || { address: '', phone: '' };
        const products = (await db.getSetting('products')) || [];
        const email_config = (await db.getSetting('email_config')); // Not default to null/empty so frontend knows if set

        // console.log('Serving settings. Products count:', products.length);

        res.json({ openingHours, holidays, holidayRanges, home_content, services, contact_info, products, email_config });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.uploadImages = async (req, res) => {
    try {
        const files = req.files ? Object.values(req.files).flat() : [];
        console.log('Uploading images:', files.map(f => f.fieldname));
        const promises = files.map(file => {
            // Save using the specific field name as ID (e.g. 'hero-bg'), ignoring extension
            // Mime type is saved in DB so serving works correctly.
            const filename = file.fieldname;
            return db.saveImage(filename, file.buffer, file.mimetype);
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
            res.setHeader('Content-Type', image.mimetype);
            res.setHeader('Cache-Control', 'no-cache'); // Prevent caching issues
            res.send(image.data);
        } else {
            console.warn(`Image not found in DB: ${filename}`);
            // Try to send a default file if DB is empty, but handling extensions is tricky without DB.
            // For now, if missing in DB, we verify if a static fallback exists using the param as is.
            res.sendFile(filename + '.jpg', { root: path.join(__dirname, '../../public/images') }, (err) => {
                if (err) {
                    console.warn(`Static fallback not found for: ${filename}`);
                    res.status(404).send('Not Found');
                }
            });
        }
    } catch (err) {
        console.error("Serve image error:", err);
        res.status(404).send('Not Found');
    }
};
