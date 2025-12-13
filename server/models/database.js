const path = require('path');

let db;
let type; // 'sqlite' or 'pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (process.env.NODE_ENV === 'test') {
  // --- Test Environment (In-Memory) ---
  type = 'sqlite';
  const Database = require('better-sqlite3');
  db = new Database(':memory:');
  console.log('Using In-Memory SQLite Database (Test)');
} else if (connectionString) {
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
  // DB is in root, we are in server/models/
  const dbPath = path.resolve(__dirname, '../../salon.db');
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        admin_id INTEGER,
        UNIQUE(date, time, admin_id)
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
          password_hash TEXT NOT NULL,
          display_name TEXT
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS leaves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          admin_id INTEGER,
          note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ... (rest of table creations)

    // Migration: Move holidayRanges setting to leaves table if exists and table is empty
    try {
      const ranges = await getSetting('holidayRanges');
      const countRes = await query('SELECT COUNT(*) as c FROM leaves');
      const count = countRes[0]?.c || countRes[0]?.count || 0;

      if (ranges && Array.isArray(ranges) && ranges.length > 0 && count === 0) {
        console.log('Migrating legacy holidayRanges to leaves table...');
        for (const r of ranges) {
          // Legacy ranges were global, so admin_id is NULL
          if (type === 'pg') {
            await db.query('INSERT INTO leaves (start_date, end_date, note) VALUES ($1, $2, $3)', [r.start, r.end, 'Legacy Migration']);
          } else {
            await query('INSERT INTO leaves (start_date, end_date, note) VALUES (?, ?, ?)', [r.start, r.end, 'Legacy Migration']);
          }
        }
        // Optional: Clear legacy setting to avoid confusion, or keep as backup?
        // Let's keep it for safety for now, or just ignore it in new logic.
      }
    } catch (e) {
      console.warn("Migration error:", e);
    }

  } else {
    // Postgres schema init
    await db.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        admin_id INTEGER,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      // ... existing tables
    `);

    // ...
  }

  // ... (rest of initDB)

  // Ensure settings exist (original logic for settings table was different, adapting to new schema)
  // The original settings table used 'key' as PK, not 'id'.
  // The provided snippet for settings init seems to assume an 'id' column.
  // I will adapt it to the existing 'key' based schema.
  const openingHoursSetting = await getSetting('openingHours');
  if (openingHoursSetting === null) {
    const defaultHours = [];
    for (let i = 0; i < 7; i++) defaultHours.push({ isOpen: true, open: '09:00', close: '18:00' });
    await setSetting('openingHours', defaultHours);
  }
  const holidayRangesSetting = await getSetting('holiday_ranges');
  if (holidayRangesSetting === null) {
    await setSetting('holiday_ranges', []);
  }
  const homeContentSetting = await getSetting('home_content');
  if (homeContentSetting === null) {
    await setSetting('home_content', { title: 'Salon Test', subtitle: 'Test Mode', philosophy: 'Testing' });
  }
  const servicesSetting = await getSetting('services');
  if (servicesSetting === null) {
    await setSetting('services', []);
  }
};

// Initialize immediately (async wrapper for PG)
// Initialize shifted to bottom

// --- Appointments ---

const getBookingsForDate = async (date, adminId) => {
  // If adminId is provided, check only their bookings. 
  // If not provided (legacy/global check), check all? 
  // Better: Slot logic should be per admin.
  if (adminId) {
    if (type === 'pg') return await query('SELECT time FROM appointments WHERE date = $1 AND admin_id = $2', [date, adminId]);
    return await query('SELECT time FROM appointments WHERE date = ? AND admin_id = ?', [date, adminId]);
  }
  // Fallback for logic without adminId (should not happen in new flow)
  return await query('SELECT time FROM appointments WHERE date = ?', [date]);
};

const getAllAppointments = async (forceAdminId = null) => {
  if (forceAdminId) {
    if (type === 'pg') return await query('SELECT * FROM appointments WHERE admin_id = $1 OR admin_id IS NULL ORDER BY date DESC, time ASC', [forceAdminId]);
    return await query('SELECT * FROM appointments WHERE admin_id = ? OR admin_id IS NULL ORDER BY date DESC, time ASC', [forceAdminId]);
  }
  return await query('SELECT * FROM appointments ORDER BY date DESC, time ASC');
};

const createBooking = async (name, date, time, service, phone, adminId) => {
  if (type === 'pg') {
    const sql = 'INSERT INTO appointments (name, date, time, service, phone, admin_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
    const res = await db.query(sql, [name, date, time, service, phone, adminId]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    return await query('INSERT INTO appointments (name, date, time, service, phone, admin_id) VALUES (?, ?, ?, ?, ?, ?)', [name, date, time, service, phone, adminId]);
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
    const sql = `
      INSERT INTO images (filename, data, mimetype) VALUES ($1, $2, $3)
      ON CONFLICT (filename) DO UPDATE SET data = EXCLUDED.data, mimetype = EXCLUDED.mimetype
      RETURNING id
    `;
    return await db.query(sql, [filename, buffer, mimetype]);
  } else {
    return await query('INSERT OR REPLACE INTO images (filename, data, mimetype) VALUES (?, ?, ?)', [filename, buffer, mimetype]);
  }
};

const getImage = async (filename) => {
  return await getOne('SELECT data, mimetype FROM images WHERE filename = ?', [filename]);
};

// Initialize DB after all functions are defined
// Initialize DB
let initPromise = initDB();
(async () => { try { await initPromise; } catch (e) { console.error(e); } })();

// --- Admins ---

const checkAdminExists = async () => {
  const result = await query('SELECT COUNT(*) as count FROM admins');
  // SQLite returns {count: N}, PG returns {count: 'N'} (or sometimes lowercase/uppercase depending on driver version, safe to parse)
  const count = result[0]?.count || result[0]?.COUNT || 0;
  return parseInt(count) > 0;
};

const createAdmin = async (username, passwordHash, displayName) => {
  // Default display name to username if not provided
  const dName = displayName || username;
  if (type === 'pg') {
    const sql = 'INSERT INTO admins (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id';
    const res = await db.query(sql, [username, passwordHash, dName]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    return await query('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)', [username, passwordHash, dName]);
  }
};

const getAdmin = async (username) => {
  return await getOne('SELECT * FROM admins WHERE username = ?', [username]);
};

const getAdminById = async (id) => {
  if (type === 'pg') return await getOne('SELECT * FROM admins WHERE id = $1', [id]);
  return await getOne('SELECT * FROM admins WHERE id = ?', [id]);
}

const getAllAdmins = async () => {
  return await query('SELECT id, username, display_name FROM admins');
};

const updateAdminPassword = async (id, newHash) => {
  if (type === 'pg') return await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, id]);
  return await query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, id]);
};

const updateAdminProfile = async (id, displayName) => {
  if (type === 'pg') return await query('UPDATE admins SET display_name = $1 WHERE id = $2', [displayName, id]);
  return await query('UPDATE admins SET display_name = ? WHERE id = ?', [displayName, id]);
};

const deleteAdmin = async (username) => {
  if (type === 'pg') return await query('DELETE FROM admins WHERE username = $1', [username]);
  return await query('DELETE FROM admins WHERE username = ?', [username]);
};


// --- Leaves ---

const createLeave = async (start, end, adminId = null, note = '') => {
  if (type === 'pg') {
    const sql = 'INSERT INTO leaves (start_date, end_date, admin_id, note) VALUES ($1, $2, $3, $4) RETURNING id';
    const res = await db.query(sql, [start, end, adminId, note]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    return await query('INSERT INTO leaves (start_date, end_date, admin_id, note) VALUES (?, ?, ?, ?)', [start, end, adminId, note]);
  }
};

const getLeaves = async (adminId = null) => {
  if (adminId) {
    if (type === 'pg') return await query('SELECT * FROM leaves WHERE admin_id = $1 OR admin_id IS NULL ORDER BY start_date', [adminId]);
    return await query('SELECT * FROM leaves WHERE admin_id = ? OR admin_id IS NULL ORDER BY start_date', [adminId]);
  }
  return await query('SELECT * FROM leaves WHERE admin_id IS NULL ORDER BY start_date');
};

const getAllLeaves = async () => {
  return await query('SELECT l.*, a.username, a.display_name FROM leaves l LEFT JOIN admins a ON l.admin_id = a.id ORDER BY start_date');
}

const deleteLeave = async (id) => {
  if (type === 'pg') return await query('DELETE FROM leaves WHERE id = $1', [id]);
  return await query('DELETE FROM leaves WHERE id = ?', [id]);
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
  getAdmin,
  getAdminById,
  getAllAdmins,
  updateAdminPassword,
  updateAdminProfile,
  createLeave,
  getLeaves,
  getAllLeaves,
  deleteLeave,
  deleteAdmin,
  type,
  initPromise
};
