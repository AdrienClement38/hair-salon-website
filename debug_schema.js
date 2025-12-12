const Database = require('better-sqlite3');
const db = new Database('salon.db');

const indices = db.prepare("SELECT * FROM sqlite_master WHERE type = 'index' AND tbl_name = 'appointments'").all();
console.log('Indices:', indices);

const tables = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'appointments'").get();
console.log('Table def:', tables);
