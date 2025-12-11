const path = require('path');

let db;
let type; // 'sqlite' or 'pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (connectionString) {
  // --- PostgreSQL (Production / Vercel) ---
  type = 'pg';
  const { Pool } = require('pg');
  db = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for most cloud DBs
  });
  console.log('Using PostgreSQL Database');
} else {
  // --- SQLite (Local Dev) ---
  type = 'sqlite';
  const Database = require('better-sqlite3');
  const dbPath = path.resolve(__dirname, 'salon.db');
  db = new Database(dbPath);
  console.log('Using SQLite Database (Local)');
}

// Helper to run queries
const query = async (sql, params = []) => {
  if (type === 'sqlite') {
    // SQLite uses ? for params. 
    // If params are named or different, we must ensure they match better-sqlite3 expectations.
    // Our existing code uses ? mostly.
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...params);
    } else {
      return stmt.run(...params);
    }
  } else {
    // Postgres uses $1, $2, etc.
    // We need to convert ? to $1, $2...
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await db.query(pgSql, params);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return res.rows;
    } else {
      // Return roughly what better-sqlite3 returns for insert/update
      return { lastInsertRowid: res.rows[0]?.id || 0, changes: res.rowCount };
    }
  }
};

// Helper for single row fetch
const getOne = async (sql, params = []) => {
  if (type === 'sqlite') {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } else {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await db.query(pgSql, params);
    return res.rows[0];
  }
};

// Init DB
const initDB = async () => {
  // We use standard SQL compatible with both where possible

  // Appointments
  const createApps = `
      CREATE TABLE IF NOT EXISTS appointments (
        id ${type === 'pg' ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        service TEXT NOT NULL,
        phone TEXT, 
        created_at ${type === 'pg' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
        UNIQUE(date, time)
      );
    `;

  // Settings
  const createSettings = `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;

  // Images (Table for storing images in DB)
  const createImages = `
      CREATE TABLE IF NOT EXISTS images (
        id ${type === 'pg' ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        data ${type === 'pg' ? 'BYTEA' : 'BLOB'} NOT NULL,
        mimetype TEXT NOT NULL
      );
    `;

  if (type === 'sqlite') {
    db.exec(createApps);
    db.exec(createSettings);
    db.exec(createImages);
  } else {
    await db.query(createApps);
    await db.query(createSettings);
    await db.query(createImages);
  }
};

// Initialize immediately (async wrapper for PG)
(async () => { await initDB(); })();

// --- Appointments ---

const getBookingsForDate = async (date) => {
  return await query('SELECT time FROM appointments WHERE date = ?', [date]);
};

const getAllAppointments = async () => {
  return await query('SELECT * FROM appointments ORDER BY date DESC, time ASC');
};

const createBooking = async (name, date, time, service, phone) => {
  if (type === 'pg') {
    // Postgres needs RETURNING id to give us the ID back
    let paramIndex = 1;
    const sql = 'INSERT INTO appointments (name, date, time, service, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const res = await db.query(sql, [name, date, time, service, phone]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    // SQLite
    return await query('INSERT INTO appointments (name, date, time, service, phone) VALUES (?, ?, ?, ?, ?)', [name, date, time, service, phone]);
  }
};

const deleteAppointment = async (id) => {
  return await query('DELETE FROM appointments WHERE id = ?', [id]);
};

const updateAppointment = async (id, time) => {
  return await query('UPDATE appointments SET time = ? WHERE id = ?', [time, id]);
};

const anonymizePastAppointments = async () => {
  const today = new Date().toISOString().split('T')[0];
  return await query("UPDATE appointments SET phone = NULL WHERE date < ? AND phone IS NOT NULL", [today]);
};

// --- Settings ---

const getSetting = async (key) => {
  const row = await getOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : null;
};

const setSetting = async (key, value) => {
  const valStr = JSON.stringify(value);
  if (type === 'pg') {
    // Upsert syntax for Postgres
    const sql = `
            INSERT INTO settings (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
         `;
    return await db.query(sql, [key, valStr]);
  } else {
    // SQLite
    return await query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
  }
};

// --- Images ---

const saveImage = async (filename, buffer, mimetype) => {
  if (type === 'pg') {
    const sql = 'INSERT INTO images (filename, data, mimetype) VALUES ($1, $2, $3) RETURNING id';
    return await db.query(sql, [filename, buffer, mimetype]);
  } else {
    return await query('INSERT INTO images (filename, data, mimetype) VALUES (?, ?, ?)', [filename, buffer, mimetype]);
  }
};

const getImage = async (filename) => {
  return await getOne('SELECT data, mimetype FROM images WHERE filename = ?', [filename]);
};


module.exports = {
  getBookingsForDate,
  getAllAppointments,
  createBooking,
  deleteAppointment,
  updateAppointment,
  anonymizePastAppointments,
  getSetting,
  setSetting,
  saveImage,
  getImage
};
