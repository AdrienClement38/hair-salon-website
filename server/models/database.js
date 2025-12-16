const path = require('path');
const fs = require('fs');

let db;
let type; // 'sqlite' or 'pg'
let SQL;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const saveDB = () => {
  if (type === 'sqlite' && db && process.env.NODE_ENV !== 'test') {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      const dbPath = path.resolve(__dirname, '../../salon.db');
      fs.writeFileSync(dbPath, buffer);
    } catch (e) {
      console.error("Failed to save DB:", e);
    }
  }
};

const query = async (sql, params = []) => {
  if (!db) await initPromise;

  if (type === 'sqlite') {
    // Sanitize params: sql.js does not like undefined, prefers null
    const safeParams = params.map(p => p === undefined ? null : p);

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      try {
        const stmt = db.prepare(sql);
        stmt.bind(safeParams);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      } catch (e) {
        console.error("Query Error (Select):", e);
        throw e;
      }
    } else {
      try {
        db.run(sql, safeParams);
        // Get last insert ID
        const idRes = db.exec("SELECT last_insert_rowid()");
        const lastId = idRes[0]?.values[0]?.[0] || 0;
        const changes = db.getRowsModified();
        saveDB();
        return { lastInsertRowid: lastId, changes: changes };
      } catch (e) {
        console.error("Query Error (Run):", e);
        throw e;
      }
    }
  } else {
    // PG
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await db.query(pgSql, params);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return res.rows;
    } else {
      return { lastInsertRowid: res.rows[0]?.id || 0, changes: res.rowCount };
    }
  }
};

const getOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0];
};

// Defined first so initDB can use them
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
    return await query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
  }
};

const initDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    type = 'sqlite';
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
    db = new SQL.Database();
    console.log('Using In-Memory sql.js (Test)');
  } else if (connectionString) {
    type = 'pg';
    const { Pool } = require('pg');
    db = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });
    console.log('Using PostgreSQL Database');
  } else {
    type = 'sqlite';
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
    const dbPath = path.resolve(__dirname, '../../salon.db');
    if (fs.existsSync(dbPath)) {
      const filebuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(filebuffer);
    } else {
      db = new SQL.Database();
      saveDB();
    }
    console.log('Using sql.js (File-based Persistence)');
  }

  if (type === 'sqlite') {
    db.run(`
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
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT UNIQUE NOT NULL,
          data BLOB NOT NULL,
          mimetype TEXT NOT NULL
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS leaves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          admin_id INTEGER,
          note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS portfolio (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          description TEXT,
          admin_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    saveDB();

    // Migration Logic
    try {
      // Need to be careful about async recursion if getSetting calls initPromise?
      // No, initDB is part of initPromise. 
      // We can manually call query if db is set.
      // getSetting uses getOne -> query -> checks db. it IS set.

      // However query checks !db await initPromise.
      // db is set above, so it should proceed.

      // Wait, migration logic from original file
      // ...
    } catch (e) {
      console.warn("Migration error:", e);
    }

  } else {
    const queries = `
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
         password_hash TEXT NOT NULL,
         display_name TEXT
       );
       CREATE TABLE IF NOT EXISTS appointments (
         id SERIAL PRIMARY KEY,
         name TEXT NOT NULL,
         phone TEXT,
         service TEXT NOT NULL,
         date TEXT NOT NULL,
         time TEXT NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         admin_id INTEGER,
         UNIQUE(date, time, admin_id)
       );
       CREATE TABLE IF NOT EXISTS leaves (
         id SERIAL PRIMARY KEY,
         start_date TEXT NOT NULL,
         end_date TEXT NOT NULL,
         admin_id INTEGER,
         note TEXT,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );
     `;
    await db.query(queries);
  }

  // Defaults
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
  const contactInfoSetting = await getSetting('contact_info');
  if (contactInfoSetting === null) {
    await setSetting('contact_info', { address: '12 Rue de la Mode, 75001 Paris', phone: '01 23 45 67 89' });
  }
  const productsSetting = await getSetting('products');
  if (productsSetting === null) {
    await setSetting('products', []);
  }
};

const getBookingsForDate = async (date, adminId) => {
  if (adminId) {
    if (type === 'pg') return await query('SELECT time FROM appointments WHERE date = $1 AND admin_id = $2', [date, adminId]);
    return await query('SELECT time FROM appointments WHERE date = ? AND admin_id = ?', [date, adminId]);
  }
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

const createPortfolioItem = async (filename, description, adminId) => {
  if (type === 'pg') {
    const sql = 'INSERT INTO portfolio (filename, description, admin_id) VALUES ($1, $2, $3) RETURNING id';
    const res = await db.query(sql, [filename, description, adminId]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    return await query('INSERT INTO portfolio (filename, description, admin_id) VALUES (?, ?, ?)', [filename, description, adminId]);
  }
};

const getPortfolioItemIds = async () => {
  return await query('SELECT id FROM portfolio ORDER BY created_at DESC'); // Date order useful for polling check, client will shuffle
}

const getPortfolioItemsByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];

  if (type === 'pg') {
    // PG specific array handling or simpler IN clause
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    return await query(`SELECT * FROM portfolio WHERE id IN (${placeholders})`, ids);
  } else {
    const placeholders = ids.map(() => '?').join(',');
    return await query(`SELECT * FROM portfolio WHERE id IN (${placeholders})`, ids);
  }
}

const getPortfolioItems = async () => {
  return await query('SELECT * FROM portfolio ORDER BY created_at DESC');
}

const deletePortfolioItem = async (id) => {
  if (type === 'pg') return await query('DELETE FROM portfolio WHERE id = $1', [id]);
  return await query('DELETE FROM portfolio WHERE id = ?', [id]);
}

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

const checkAdminExists = async () => {
  const result = await query('SELECT COUNT(*) as count FROM admins');
  const count = result[0]?.count || result[0]?.COUNT || 0;
  return parseInt(count) > 0;
};

const createAdmin = async (username, passwordHash, displayName) => {
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
  const admin = await getAdmin(username);
  if (!admin) return;

  if (type === 'pg') {
    await query('DELETE FROM leaves WHERE admin_id = $1', [admin.id]);
    await query('DELETE FROM appointments WHERE admin_id = $1', [admin.id]);
    return await query('DELETE FROM admins WHERE username = $1', [username]);
  }
  await query('DELETE FROM leaves WHERE admin_id = ?', [admin.id]);
  await query('DELETE FROM appointments WHERE admin_id = ?', [admin.id]);
  return await query('DELETE FROM admins WHERE username = ?', [username]);
};

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

let initPromise = initDB().catch(e => console.error(e));

module.exports = {
  getBookingsForDate,
  getAllAppointments,
  createBooking,
  deleteAppointment,
  updateAppointment,
  anonymizePastAppointments,
  anonymizePastAppointments,
  createPortfolioItem,
  getPortfolioItems,
  getPortfolioItemIds,
  getPortfolioItemsByIds,
  deletePortfolioItem,
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
