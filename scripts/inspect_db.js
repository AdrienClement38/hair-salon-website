const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../salon.db');
console.log('Opening DB at:', dbPath);

const db = new Database(dbPath, { readonly: true });

try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'products'").get();
    if (row) {
        console.log('Products Setting Found:');
        console.log(row.value);
    } else {
        console.log('Products Setting NOT FOUND in DB.');
    }
} catch (e) {
    console.error('Error reading DB:', e);
}
