const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');
const bcrypt = require('bcryptjs');

async function verify() {
    const dbPath = path.resolve(__dirname, 'salon.db');
    console.log('Verifying DB at:', dbPath);

    if (!fs.existsSync(dbPath)) {
        console.log('File does not exist!');
        return;
    }

    const filebuffer = fs.readFileSync(dbPath);
    const SQL = await initSqlJs();
    const db = new SQL.Database(filebuffer);

    try {
        const res = db.exec("SELECT * FROM admins WHERE username = 'admin'");
        if (res.length > 0) {
            const row = res[0].values[0];
            // Columns: id, username, password_hash, display_name
            // Inspecting database.js schema: 
            // id (0), username (1), password_hash (2), display_name (3)
            // But relying on column index is risky, let's look at 'columns' property
            const columns = res[0].columns;
            const hashIndex = columns.indexOf('password_hash');
            const hash = row[hashIndex];

            console.log('Found admin user.');
            console.log('Hash in DB:', hash);

            const match = await bcrypt.compare('12345678', hash);
            console.log('Does "12345678" match?', match);
        } else {
            console.log('Admin user not found.');
        }
    } catch (e) {
        console.log('Error querying:', e.message);
    }
}

verify();
