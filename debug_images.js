const db = require('./server/models/database');

async function checkImages() {
    console.log("Checking images table...");
    try {
        // We can't use db.query directly because it's not exported, but db.getImage is.
        // But we want to list all images.
        // Wait, db.js exports ONLY specific functions.
        // But I can require better-sqlite3 directly here if I want.

        const Database = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.resolve(__dirname, 'salon.db');
        const sqlite = new Database(dbPath);

        const rows = sqlite.prepare('SELECT id, filename, length(data) as size, mimetype FROM images').all();
        console.log("Images found:", rows);

    } catch (e) {
        console.error("Error:", e);
    }
}

checkImages();
