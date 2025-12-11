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

  if (type === 'sqlite') {
    db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        service TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT UNIQUE NOT NULL,
          data BLOB NOT NULL,
          mimetype TEXT NOT NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL
      )
    `);
  } else {
    // Postgres schema init handled by tables creation if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        service TEXT NOT NULL,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, time)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        data BYTEA NOT NULL,
        mimetype TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);
  }

  // Ensure settings exist (original logic for settings table was different, adapting to new schema)
  // The original settings table used 'key' as PK, not 'id'.
  // The provided snippet for settings init seems to assume an 'id' column.
  // I will adapt it to the existing 'key' based schema.
  const openingHoursSetting = await getSetting('opening_hours');
  if (openingHoursSetting === null) {
    await setSetting('opening_hours', {});
  }
  const holidayRangesSetting = await getSetting('holiday_ranges');
  if (holidayRangesSetting === null) {
    await setSetting('holiday_ranges', []);
  }
};

// Initialize immediately (async wrapper for PG)
// Initialize shifted to bottom

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

// Initialize DB after all functions are defined
(async () => { await initDB(); })();

const checkAdminExists = async () => {
  const result = await query('SELECT COUNT(*) as count FROM admins');
  // SQLite returns {count: N}, PG returns {count: 'N'} (or sometimes lowercase/uppercase depending on driver version, safe to parse)
  const count = result[0]?.count || result[0]?.COUNT || 0;
  return parseInt(count) > 0;
};

const createAdmin = async (username, passwordHash) => {
  if (type === 'pg') {
    const sql = 'INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id';
    return await db.query(sql, [username, passwordHash]);
  } else {
    return await query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
  }
};

const getAdmin = async (username) => {
  return await getOne('SELECT * FROM admins WHERE username = ?', [username]);
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
  getImage,
  checkAdminExists,
  createAdmin,
  getAdmin
};
