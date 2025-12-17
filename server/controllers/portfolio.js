const db = require('../models/database');
const fs = require('fs');
const path = require('path');

exports.list = async (req, res) => {
    try {
        const items = await db.getPortfolioItems();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.create = async (req, res) => {
    const { description } = req.body;
    const file = req.file; // Multer upload.single puts file here

    if (!file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    try {
        // 1. Save Image to DB (or filesystem, but using DB as per project pattern)
        const filename = `portfolio_${Date.now()}`;
        await db.saveImage(filename, file.buffer, file.mimetype);

        // 2. Create Portfolio Entry
        // req.user is set by auth middleware
        const adminId = req.user ? req.user.id : null;
        await db.createPortfolioItem(filename, description, adminId);

        res.json({ success: true });
    } catch (err) {
        console.error("Portfolio upload error:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await db.deletePortfolioItem(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
