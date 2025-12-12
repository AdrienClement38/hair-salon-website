const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'salon.db');
const db = new Database(dbPath);

console.log("Fixing database...");

try {
    const info = db.prepare("UPDATE images SET filename = 'hero-bg' WHERE filename = 'hero-bg.jpg'").run();
    console.log("Update result:", info);

    const rows = db.prepare("SELECT * FROM images").all();
    console.log("Current images:", rows.map(r => r.filename));

} catch (e) {
    console.error("Error:", e);
}
