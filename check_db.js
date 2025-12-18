const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');

async function check() {
    const dbPath = path.resolve(__dirname, 'salon.db');
    console.log('Checking DB at:', dbPath);

    if (!fs.existsSync(dbPath)) {
        console.log('File does not exist!');
        return;
    }

    const filebuffer = fs.readFileSync(dbPath);
    console.log(`File size: ${filebuffer.length} bytes`);

    const SQL = await initSqlJs();
    const db = new SQL.Database(filebuffer);

    try {
        const res = db.exec("SELECT * FROM admins");
        if (res.length > 0) {
            console.log('Admins found:', res[0].values);
        } else {
            console.log('No admins table or no rows.');
        }
    } catch (e) {
        console.log('Error querying admins:', e.message);
    }
}

check();
