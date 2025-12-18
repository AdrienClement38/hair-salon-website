const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');
const bcrypt = require('bcryptjs');

async function reset() {
    const dbPath = path.resolve(__dirname, 'salon.db');
    console.log('Resetting DB at:', dbPath);

    if (!fs.existsSync(dbPath)) {
        console.log('File does not exist!');
        return;
    }

    const filebuffer = fs.readFileSync(dbPath);
    const SQL = await initSqlJs();
    const db = new SQL.Database(filebuffer);

    try {
        const password = '12345678';
        const hash = await bcrypt.hash(password, 10);
        console.log('New hash generated.');

        db.run("UPDATE admins SET password_hash = ? WHERE username = 'admin'", [hash]);
        console.log('Password updated for user "admin".');

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
        console.log('Database saved successfully.');
    } catch (e) {
        console.log('Error resetting password:', e.message);
    }
}

reset();
