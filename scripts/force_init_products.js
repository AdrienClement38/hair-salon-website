const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../salon.db');
const db = new Database(dbPath);

console.log('--- Inspecting Schema ---');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='settings'").get();
console.log(schema ? schema.sql : 'TABLE NOT FOUND');

console.log('--- Checking Products ---');
let row = db.prepare("SELECT * FROM settings WHERE key = 'products'").get();
if (row) {
    console.log('Products found:', row.value);
} else {
    console.log('Products NOT found. Inserting default...');
    try {
        const info = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('products', '[]');
        console.log('Inserted. Changes:', info.changes);

        // Verify
        const verify = db.prepare("SELECT * FROM settings WHERE key = 'products'").get();
        console.log('Verification read:', verify);
    } catch (e) {
        console.error('Insert failed:', e);
    }
}
