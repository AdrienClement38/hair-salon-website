const Database = require('better-sqlite3');
const db = new Database('salon.db');

try {
    console.log('Starting migration...');

    // 1. Rename old table
    db.exec("ALTER TABLE appointments RENAME TO appointments_old");
    console.log('Renamed old table');

    // 2. Create new table (Based on correct schema in database.js, but WITHOUT global UNIQUE on date/time)
    // We want unique on (date, time, admin_id) OR handle it in app.
    // Let's add UNIQUE(date, time, admin_id) to be safe, assuming admin_id is not null for new appts.
    // But for old appts admin_id is null.
    // Unique partial index? "CREATE UNIQUE INDEX idx_slots ON appointments(date, time) WHERE admin_id IS NULL" ?
    // Simplest: No DB constraint, rely on app logic (which checks slots), OR Unique(date, time, admin_id).
    // Let's go with NO strict table constraint for now to solve the immediate blocking issue, 
    // and rely on the application's slot checking (which we verified does "SELECT time FROM ... WHERE ...")
    // Use the schema from database.js lines 72-82 but ensure admin_id is included in creation.

    db.exec(`
      CREATE TABLE appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        service TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        admin_id INTEGER
      )
    `);
    console.log('Created new table');

    // 3. Copy data
    db.exec(`
      INSERT INTO appointments (id, name, phone, service, date, time, created_at, admin_id)
      SELECT id, name, phone, service, date, time, created_at, admin_id
      FROM appointments_old
    `);
    console.log('Copied data');

    // 4. Drop old table
    db.exec("DROP TABLE appointments_old");
    console.log('Dropped old table');

    console.log('Migration successful!');

} catch (e) {
    console.error('Migration failed:', e);
}
