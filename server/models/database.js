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
      const tempPath = dbPath + '.tmp';

      // Atomic write: write to temp file, then rename
      fs.writeFileSync(tempPath, buffer);

      // Retry rename if locked (basic retry logic)
      try {
        fs.renameSync(tempPath, dbPath);
      } catch (err) {
        console.warn("Rename failed (locked?), retrying in 100ms...", err.message);
        setTimeout(() => {
          try {
            fs.renameSync(tempPath, dbPath);
          } catch (e) {
            console.error("Retry failed, DB not saved:", e.message);
          }
        }, 100);
      }
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

    // TRY LOADING EXISTING DB FOR REALISTIC TESTING
    const dbPath = path.resolve(__dirname, '../../salon.db');
    // console.log('[DEBUG] initDB Test Mode. Path:', dbPath, 'FS:', !!fs);
    if (fs.existsSync(dbPath)) {
      try {
        const filebuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(filebuffer);
        // console.log('TEST MODE: Loaded production DB clone.');
      } catch (e) {
        // console.warn('TEST MODE: Failed to load production DB, starting empty.', e);
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    // Ensure saveDB does nothing in test mode (implicit by check in saveDB)
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
         display_name TEXT,
         days_off TEXT
       );
    `);

    // Migration: Add days_off logic
    try {
      db.run("ALTER TABLE admins ADD COLUMN days_off TEXT", (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error("Migration Error (ignored if duplicate):", err.message);
        }
      });
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error("Migration Exception (ignored if duplicate):", e.message);
      }
    }

    try {
      db.run("ALTER TABLE appointments ADD COLUMN email TEXT", (err) => { });
    } catch (e) { }

    // Migration: Add status to appointments
    try {
      db.run("ALTER TABLE appointments ADD COLUMN status TEXT DEFAULT 'CONFIRMED'", (err) => { });
    } catch (e) { }

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
    db.run(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
          token TEXT PRIMARY KEY,
          admin_id INTEGER NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS waiting_list_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_name TEXT NOT NULL,
          client_email TEXT NOT NULL,
          client_phone TEXT,
          target_date TEXT NOT NULL,
          desired_service_id TEXT NOT NULL,
          desired_worker_id INTEGER,
          status TEXT DEFAULT 'WAITING',
          offer_token TEXT,
          offer_expires_at DATETIME,
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
         display_name TEXT,
         days_off TEXT
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
       CREATE TABLE IF NOT EXISTS portfolio (
          id SERIAL PRIMARY KEY,
          filename TEXT NOT NULL,
          description TEXT,
          admin_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );
       CREATE TABLE IF NOT EXISTS password_reset_tokens (
          token TEXT PRIMARY KEY,
          admin_id INTEGER NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );
       CREATE TABLE IF NOT EXISTS waiting_list_requests (
          id SERIAL PRIMARY KEY,
          client_name TEXT NOT NULL,
          client_email TEXT NOT NULL,
          client_phone TEXT,
          target_date TEXT NOT NULL,
          desired_service_id TEXT NOT NULL,
          desired_worker_id INTEGER,
          status TEXT DEFAULT 'WAITING',
          offer_token TEXT,
          offer_expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );
     `;
    await db.query(queries);

    // Migration: Add days_off to admins if missing
    try {
      await db.query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS days_off TEXT");
    } catch (e) {
      console.log('PG Migration (days_off):', e.message);
    }

    // Migration: Add email to appointments if missing
    try {
      await db.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS email TEXT");
    } catch (e) {
      console.log('PG Migration (email):', e.message);
    }

    // Migration: Add status to appointments if missing
    try {
      await db.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'CONFIRMED'");
    } catch (e) {
      console.log('PG Migration (status):', e.message);
    }
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

const initPromise = initDB();

const getBookingsForDate = async (date, adminId) => {
  if (adminId) {
    if (type === 'pg') return await query('SELECT time, service FROM appointments WHERE date = $1 AND admin_id = $2', [date, adminId]);
    return await query('SELECT time, service FROM appointments WHERE date = ? AND admin_id = ?', [date, adminId]);
  }
  return await query('SELECT time FROM appointments WHERE date = ?', [date]);
};

const getAppointmentsForWorker = async (date, workerId) => {
  // Return all appointments for this worker on this date, sorted by time
  if (type === 'pg') {
    return await query('SELECT * FROM appointments WHERE date = $1 AND (admin_id = $2 OR admin_id IS NULL) ORDER BY time ASC', [date, workerId]);
  } else {
    return await query('SELECT * FROM appointments WHERE date = ? AND (admin_id = ? OR admin_id IS NULL) ORDER BY time ASC', [date, workerId]);
  }
};

const getDailyGaps = async (date, workerId, _injectedOpeningHours = null) => {
  // 1. Get Opening Hours
  // Fallback defaults if settings are completely missing
  let dayStart = 9 * 60 + 30; // 09:30 default
  let dayEnd = 19 * 60;       // 19:00 default
  let breakInterval = null;

  try {
    // getSetting returns parsed object. _injected is object.
    const openingHours = _injectedOpeningHours || await getSetting('opening_hours');

    if (openingHours) {
      const dayIndex = new Date(date).getDay();

      // Adjust day index if needed (DB vs JS matching)
      // Assuming standard JS 0-6.
      let dayConfig;
      if (Array.isArray(openingHours)) {
        // Robust Lookup: Find object with matching 'day' property
        // Because array order might not match 0-6 index
        dayConfig = openingHours.find(d => d.day === dayIndex || String(d.day) === String(dayIndex));

        // Fallback: If not found or 'day' prop missing, try index (legacy array structure)
        if (!dayConfig && openingHours[dayIndex]) {
          dayConfig = openingHours[dayIndex];
        }
      } else {
        // Object Map structure
        dayConfig = openingHours[dayIndex] || openingHours[String(dayIndex)];
      }

      // If dayConfig exists and isOpen is false (or not open), treat as closed (00:00-00:00 or skip?)
      // Actually if closed, dayStart=dayEnd is best to prevent slots.
      if (dayConfig) {
        if (dayConfig.isOpen === false) {
          dayStart = 0;
          dayEnd = 0;
        } else if (dayConfig.start && dayConfig.end) {
          const [sh, sm] = dayConfig.start.split(':').map(Number);
          const [eh, em] = dayConfig.end.split(':').map(Number);
          dayStart = sh * 60 + sm;
          dayEnd = eh * 60 + em;

          // Log what we found
          // console.log(`[GapDebug] Day ${dayIndex} Config (Matched):`, dayConfig);

          if (dayConfig.pause_start && dayConfig.pause_end) {
            const [bsh, bsm] = dayConfig.pause_start.split(':').map(Number);
            const [beh, bem] = dayConfig.pause_end.split(':').map(Number);
            breakInterval = { start: bsh * 60 + bsm, end: beh * 60 + bem };
          } else if (dayConfig.breakStart && dayConfig.breakEnd) {
            // Fallback for legacy keys
            const [bsh, bsm] = dayConfig.breakStart.split(':').map(Number);
            const [beh, bem] = dayConfig.breakEnd.split(':').map(Number);
            breakInterval = { start: bsh * 60 + bsm, end: beh * 60 + bem };
          }
        }
      }
    }
  } catch (e) { console.warn('Gap Calc: Failed to parse opening hours', e); }

  // 2. Get Appointments
  const appts = await getAppointmentsForWorker(date, workerId);

  // 3. Calculate Gaps

  const timeToMins = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const minsToTime = (m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  // Helper to get duration of an appt (Name -> Duration)
  // We need services setting
  let services = [];
  try {
    const sStr = await getSetting('services');
    if (sStr) services = JSON.parse(sStr);
  } catch (e) { }

  const getDuration = (name) => {
    if (!services || !Array.isArray(services)) return 30;
    const s = services.find(srv => srv.name === name);
    return s ? s.duration : 30;
  };

  let busyIntervals = appts.map(appt => {
    const start = timeToMins(appt.time);
    const duration = getDuration(appt.service);
    return { start, end: start + duration };
  });

  if (breakInterval) {
    busyIntervals.push(breakInterval);
  }

  // Sort by start to handle mixed inputs
  busyIntervals.sort((a, b) => a.start - b.start);

  // MERGE OVERLAPPING INTERVALS
  const mergedIntervals = [];
  if (busyIntervals.length > 0) {
    let current = busyIntervals[0];
    for (let i = 1; i < busyIntervals.length; i++) {
      const next = busyIntervals[i];
      if (next.start <= current.end) {
        // Overlap or touch: extend current end if needed
        current.end = Math.max(current.end, next.end);
      } else {
        // No overlap: push current and move to next
        mergedIntervals.push(current);
        current = next;
      }
    }
    mergedIntervals.push(current);
  }

  // DEBUG LOG
  try {
    console.log(`[getDailyGaps] Date: ${date} Worker: ${workerId}`);
    console.log('[getDailyGaps] Busy Raw:', busyIntervals.map(b => `${minsToTime(b.start)}-${minsToTime(b.end)}`));
    console.log('[getDailyGaps] Merged:', mergedIntervals.map(b => `${minsToTime(b.start)}-${minsToTime(b.end)}`));
  } catch (e) { console.log('Log Error', e); }

  const gaps = [];
  let currentPointer = dayStart;

  for (const busy of mergedIntervals) {
    const bStart = Math.max(busy.start, dayStart);
    const bEnd = Math.min(busy.end, dayEnd);

    // console.log(`Busy: ${minsToTime(bStart)} - ${minsToTime(bEnd)}`);

    if (bStart >= bEnd) continue; // Invalid or out of bounds

    // Check gap before this busy slot
    if (bStart > currentPointer) {
      const gapDur = bStart - currentPointer;
      if (gapDur > 0) {
        gaps.push({
          start: minsToTime(currentPointer),
          end: minsToTime(bStart),
          duration: gapDur
        });
      }
    }

    // Move pointer to end of this appointment
    if (bEnd > currentPointer) {
      currentPointer = bEnd;
    }
  }


  // Check final gap
  if (currentPointer < dayEnd) {
    gaps.push({
      start: minsToTime(currentPointer),
      end: minsToTime(dayEnd),
      duration: dayEnd - currentPointer
    });
  }

  // SAFETY NET: Critical Boundary Check
  // Filter gaps against Day Limits AND Break Limits
  return gaps.filter(g => {
    const gStart = timeToMins(g.start);
    const gEnd = timeToMins(g.end);

    // 1. Day Boundaries
    if (gStart < dayStart) return false; // Starts before opening
    if (gEnd > dayEnd) return false;     // Ends after closing

    // 2. Break Boundaries (if defined)
    if (breakInterval) {
      const isBefore = gEnd <= breakInterval.start;
      const isAfter = gStart >= breakInterval.end;

      if (!isBefore && !isAfter) return false; // Overlaps break
    }

    return true;
  });
};

const getAllAppointments = async (forceAdminId = null) => {


  if (forceAdminId) {
    if (type === 'pg') return await query('SELECT * FROM appointments WHERE admin_id = $1 OR admin_id IS NULL ORDER BY date DESC, time ASC', [forceAdminId]);
    return await query('SELECT * FROM appointments WHERE admin_id = ? OR admin_id IS NULL ORDER BY date DESC, time ASC', [forceAdminId]);
  }
  return await query('SELECT * FROM appointments ORDER BY date DESC, time ASC');
};

const createBooking = async (name, date, time, service, phone, adminId, email, status = 'CONFIRMED') => {
  if (type === 'pg') {
    const sql = 'INSERT INTO appointments (name, date, time, service, phone, admin_id, email, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
    const res = await db.query(sql, [name, date, time, service, phone, adminId, email || null, status]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    return await query('INSERT INTO appointments (name, date, time, service, phone, admin_id, email, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [name, date, time, service, phone, adminId, email || null, status]);
  }
};

const getAppointmentById = async (id) => {
  if (type === 'pg') return await getOne('SELECT * FROM appointments WHERE id = $1', [id]);
  return await getOne('SELECT * FROM appointments WHERE id = ?', [id]);
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

const purgeOldAppointments = async (daysToKeep = 7) => {
  // Calculate cutoff date in JS to be DB-agnostic
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  if (type === 'pg') {
    return await query('DELETE FROM appointments WHERE date < $1', [cutoffStr]);
  } else {
    return await query('DELETE FROM appointments WHERE date < ?', [cutoffStr]);
  }
};

const deleteImage = async (filename) => {
  if (type === 'pg') {
    return await query('DELETE FROM images WHERE filename = $1', [filename]);
  } else {
    return await query('DELETE FROM images WHERE filename = ?', [filename]);
  }
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

const createResetToken = async (token, adminId, expiresAt) => {
  const expires = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
  if (type === 'pg') {
    return await query('INSERT INTO password_reset_tokens (token, admin_id, expires_at) VALUES ($1, $2, $3)', [token, adminId, expires]);
  } else {
    return await query('INSERT INTO password_reset_tokens (token, admin_id, expires_at) VALUES (?, ?, ?)', [token, adminId, expires]);
  }
};

const getResetToken = async (token) => {
  const row = await getOne('SELECT * FROM password_reset_tokens WHERE token = ?', [token]);
  // Check if expired logic can be done here or in controller. Controller is fine.
  return row;
};

const deleteResetToken = async (token) => {
  if (type === 'pg') return await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
  return await query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
};

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

const createAdmin = async (username, passwordHash, displayName, daysOff = []) => {
  const dName = displayName || username;
  const dOff = JSON.stringify(daysOff);
  if (type === 'pg') {
    const sql = 'INSERT INTO admins (username, password_hash, display_name, days_off) VALUES ($1, $2, $3, $4) RETURNING id';
    const res = await db.query(sql, [username, passwordHash, dName, dOff]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    return await query('INSERT INTO admins (username, password_hash, display_name, days_off) VALUES (?, ?, ?, ?)', [username, passwordHash, dName, dOff]);
  }
};

const createWorker = async (username, email, phone, color, daysOff, password) => {
  // Wrapper for createAdmin to satisfy tests. Ignores extra fields not in schema yet.
  // Note: Password passed is used as hash directly for tests.
  return await createAdmin(username, password, username, daysOff);
};

const findAdminInternal = async (username) => {
  console.log(`[DB] findAdminInternal called for: '${username}'`);
  const admin = await getOne('SELECT * FROM admins WHERE username = ?', [username]);
  console.log(`[DB] findAdminInternal result:`, admin ? 'Found' : 'Null');
  return admin;
};

const getAdminById = async (id) => {
  if (type === 'pg') return await getOne('SELECT * FROM admins WHERE id = $1', [id]);
  return await getOne('SELECT * FROM admins WHERE id = ?', [id]);
}

const getAllAdmins = async () => {
  const rows = await query('SELECT id, username, display_name, days_off FROM admins');
  return rows.map(r => ({ ...r, days_off: r.days_off ? JSON.parse(r.days_off) : [] }));
};

const updateAdminDaysOff = async (id, daysOff) => {
  const val = JSON.stringify(daysOff);
  if (type === 'pg') return await query('UPDATE admins SET days_off = $1 WHERE id = $2', [val, id]);
  return await query('UPDATE admins SET days_off = ? WHERE id = ?', [val, id]);
};

const updateAdminPassword = async (id, newHash) => {
  if (type === 'pg') return await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, id]);
  return await query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, id]);
};

const updateAdminProfile = async (id, displayName, username) => {
  console.log('DB: updateAdminProfile', { id, displayName, username });
  if (typeof username !== 'undefined') {
    if (type === 'pg') return await query('UPDATE admins SET display_name = $1, username = $2 WHERE id = $3', [displayName, username, id]);
    return await query('UPDATE admins SET display_name = ?, username = ? WHERE id = ?', [displayName, username, id]);
  } else {
    // Legacy support or fallback if no username passed
    if (type === 'pg') return await query('UPDATE admins SET display_name = $1 WHERE id = $2', [displayName, id]);
    return await query('UPDATE admins SET display_name = ? WHERE id = ?', [displayName, id]);
  }
};

const deleteAdmin = async (username) => {
  const admin = await findAdminInternal(username);
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

const updateLeave = async (id, startDate, endDate, note) => {
  if (type === 'pg') {
    return await query('UPDATE leaves SET start_date = $1, end_date = $2, note = $3 WHERE id = $4', [startDate, endDate, note, id]);
  } else {
    return await query('UPDATE leaves SET start_date = ?, end_date = ?, note = ? WHERE id = ?', [startDate, endDate, note, id]);
  }
};

const deleteLeave = async (id) => {
  if (type === 'pg') return await query('DELETE FROM leaves WHERE id = $1', [id]);
  return await query('DELETE FROM leaves WHERE id = ?', [id]);
};

// Check for conflicts within a date range (for Leaves/Closures)
// Check for conflicts within a date range (for Leaves/Closures)
const checkAppointmentConflicts = async (start, end, adminId = null) => {
  // If adminId is provided (specific worker), check only their appointments.
  // If adminId is null (Global), check ALL appointments during that time.
  // Note: Appts have date YYYY-MM-DD. Leaves have start_date/end_date YYYY-MM-DD.
  // We assume full day blocking.

  let sql;
  const params = [start, end];

  if (adminId) {
    if (type === 'pg') {
      sql = `
        SELECT a.*, adm.display_name as worker_name, adm.username as worker_username 
        FROM appointments a 
        LEFT JOIN admins adm ON a.admin_id = adm.id 
        WHERE a.date >= $1 AND a.date <= $2 AND a.admin_id = $3
      `;
    } else {
      sql = `
        SELECT a.*, adm.display_name as worker_name, adm.username as worker_username 
        FROM appointments a 
        LEFT JOIN admins adm ON a.admin_id = adm.id 
        WHERE a.date >= ? AND a.date <= ? AND a.admin_id = ?
      `;
    }
    params.push(adminId);
  } else {
    // Global closure blocks everyone
    if (type === 'pg') {
      sql = `
        SELECT a.*, adm.display_name as worker_name, adm.username as worker_username 
        FROM appointments a 
        LEFT JOIN admins adm ON a.admin_id = adm.id 
        WHERE a.date >= $1 AND a.date <= $2
      `;
    } else {
      sql = `
        SELECT a.*, adm.display_name as worker_name, adm.username as worker_username 
        FROM appointments a 
        LEFT JOIN admins adm ON a.admin_id = adm.id 
        WHERE a.date >= ? AND a.date <= ?
      `;
    }
  }

  const rows = await query(sql, params);
  return rows; // Returns array of conflicting appointments
};

// Check for conflicts with recurring days off
const checkDaysOffConflicts = async (adminId, daysOff = []) => {
  if (!adminId || !daysOff.length) return [];

  // Get all future appointments for this admin
  const today = new Date().toISOString().split('T')[0];
  let sql;
  if (type === 'pg') {
    sql = 'SELECT * FROM appointments WHERE date >= $1 AND admin_id = $2';
  } else {
    sql = 'SELECT * FROM appointments WHERE date >= ? AND admin_id = ?';
  }

  const appointments = await query(sql, [today, adminId]);

  // Filter in JS
  // daysOff is array of integers (e.g. [1, 5] for Mon, Fri) matches getDay() logic?
  // In this app/DB: 0=Sun, 1=Mon...6=Sat.
  // Settings.js: "Visual: 0(Lun)... DB: 1(Lun)... 0(Sun)".
  // Wait, let's verify standard JS getDay(): 0 is Sunday, 1 is Monday.
  // In Settings.js:
  // "Map visual index (0=Lun) to DB index... let dbValue = index + 1; if (dbValue === 7) dbValue = 0;"
  // So DB stores standard JS getDay() values (0=Sun, 1=Mon...). Correct.

  const conflicts = appointments.filter(appt => {
    const d = new Date(appt.date);
    const dayIndex = d.getDay(); // 0-6
    return daysOff.includes(dayIndex);
  });

  return conflicts;
};

// --- Waiting List Helpers ---

const addWaitingListRequest = async (name, email, phone, date, serviceId, workerId) => {
  if (type === 'pg') {
    const sql = `INSERT INTO waiting_list_requests 
    (client_name, client_email, client_phone, target_date, desired_service_id, desired_worker_id, status) 
    VALUES ($1, $2, $3, $4, $5, $6, 'WAITING') RETURNING id`;
    const res = await db.query(sql, [name, email, phone, date, serviceId, workerId || null]);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    return await query(`INSERT INTO waiting_list_requests 
    (client_name, client_email, client_phone, target_date, desired_service_id, desired_worker_id, status) 
    VALUES (?, ?, ?, ?, ?, ?, 'WAITING')`, [name, email, phone, date, serviceId, workerId || null]);
  }
};

const getPendingWaitingDates = async () => {
  // Return distinct dates holding WAITING requests
  const sql = "SELECT DISTINCT target_date FROM waiting_list_requests WHERE status = 'WAITING'";
  const rows = await query(sql);
  // rows is array of objects { target_date: 'YYYY-MM-DD' }
  return rows.map(r => r.target_date);
};

const findNextWaitingRequest = async (date, serviceIdsCompatible, workerId = null) => {
  // Logic: Find oldest 'WAITING' request for this date
  // worker logic: if workerId provided, find req with specific workerId OR null (any)
  // service logic: simplistic match or handled by Service (we pass serviceIdsCompatible array?)
  // For DB simplicty, let's select all waiting for DATE and filter in JS if complex

  let sql;
  const params = [date];

  if (type === 'pg') {
    sql = "SELECT * FROM waiting_list_requests WHERE target_date = $1 AND status = 'WAITING' ORDER BY created_at ASC";
  } else {
    sql = "SELECT * FROM waiting_list_requests WHERE target_date = ? AND status = 'WAITING' ORDER BY created_at ASC";
  }

  const allWaiting = await query(sql, params);

  // Filter in JS for flexibility
  return allWaiting.filter(req => {
    // 1. Worker Check
    // If request has desired_worker_id, it must match workerId (or workerId is null? No, workerId comes from cancellation)
    // If request has desired_worker_id provided, it means client wants THAT worker.
    // So if workerId (freed) != req.desired_worker_id, skip.
    // If req.desired_worker_id is NULL (Any), then it matches anyone.

    // BUT, if the cancellation is for a specific worker (workerId), we can only offer it to:
    // a) People waiting for that worker
    // b) People waiting for ANY worker

    if (req.desired_worker_id && workerId && req.desired_worker_id != workerId) {
      return false;
    }

    // 2. Service Duration Check (Simplistic: We assume if they wait for 'serviceIdsCompatible' it fits?
    // The caller passes 'serviceIdsCompatible' which is an array of NAMES?
    // database.js signature says `serviceIdsCompatible`.
    // In waitingListService it passes `compatibleServiceNames`.
    // So we check if req.desired_service_id (which holds Name currently) is in the array.

    if (serviceIdsCompatible && serviceIdsCompatible.length > 0) {
      if (!serviceIdsCompatible.includes(req.desired_service_id)) {
        return false;
      }
    }

    console.log('[Debug DB] MATCH CONFIRMED for Req:', req.id);
    return true;
  })[0]; // Return the first one (FIFO)
};

const updateWaitingRequestStatus = async (id, status, token = null, expires = null) => {
  // Updates status, and optionally sets token/expiry (for making an offer)
  if (type === 'pg') {
    let sql = "UPDATE waiting_list_requests SET status = $1";
    const params = [status];
    let idx = 2;

    if (token) { sql += `, offer_token = $${idx++}`; params.push(token); }
    if (expires) { sql += `, offer_expires_at = $${idx++}`; params.push(expires); }

    sql += ` WHERE id = $${idx}`;
    params.push(id);
    return await query(sql, params);
  } else {
    let sql = "UPDATE waiting_list_requests SET status = ?";
    const params = [status];

    if (token) { sql += ", offer_token = ?"; params.push(token); }
    if (expires) { sql += ", offer_expires_at = ?"; params.push(expires); }

    sql += " WHERE id = ?";
    params.push(id);
    return await query(sql, params);
  }
};

const getWaitingRequestByToken = async (token) => {
  if (type === 'pg') return await getOne('SELECT * FROM waiting_list_requests WHERE offer_token = $1', [token]);
  return await getOne('SELECT * FROM waiting_list_requests WHERE offer_token = ?', [token]);
};

const getExpiredOffers = async () => {
  // Check requests that are sent but expired
  const now = new Date(); // ISO String for compare?
  // SQLite stores dates as strings properly if we use ISO.
  // However NOW() function in SQL differs. Let's select potentially expired and filter JS to be safe/consistent

  // Simplification: Select all SENT
  let rows;
  if (type === 'pg') rows = await query("SELECT * FROM waiting_list_requests WHERE status = 'OFFER_SENT'");
  else rows = await query("SELECT * FROM waiting_list_requests WHERE status = 'OFFER_SENT'");

  return rows.filter(r => {
    if (!r.offer_expires_at) return false;
    return new Date(r.offer_expires_at) < now;
  });
};

const getWaitingListCounts = async (date) => {
  // Returns counts of WAITING requests grouped by desired_worker_id
  if (type === 'pg') {
    const sql = "SELECT desired_worker_id, COUNT(*) as count FROM waiting_list_requests WHERE target_date = $1 AND status IN ('WAITING', 'OFFER_SENT') GROUP BY desired_worker_id";
    return await query(sql, [date]);
  } else {
    const sql = "SELECT desired_worker_id, COUNT(*) as count FROM waiting_list_requests WHERE target_date = ? AND status IN ('WAITING', 'OFFER_SENT') GROUP BY desired_worker_id";
    return await query(sql, [date]);
  }
};

const getWaitingRequestsForDate = async (date) => {
  // Returns full WAITING requests for a date
  let sql;
  const params = [date];
  if (type === 'pg') {
    sql = "SELECT * FROM waiting_list_requests WHERE target_date = $1 AND status IN ('WAITING', 'OFFER_SENT') ORDER BY created_at ASC";
  } else {
    sql = "SELECT * FROM waiting_list_requests WHERE target_date = ? AND status IN ('WAITING', 'OFFER_SENT') ORDER BY created_at ASC";
  }
  return await query(sql, params);
};

const deleteHoldAppointment = async (email, date, time) => {
  // Remove the temporary HOLD appointment linked to this email/slot
  // Status must be HOLD?
  // Let's assume we uniquely identify it by email+date+time (since HOLD appts are created with client email)
  // Better: store apptID in waiting_list? Or just search

  // Safe delete:
  if (type === 'pg') {
    return await query("DELETE FROM appointments WHERE email = $1 AND date = $2 AND time = $3 AND status = 'HOLD'", [email, date, time]);
  } else {
    return await query("DELETE FROM appointments WHERE email = ? AND date = ? AND time = ? AND status = 'HOLD'", [email, date, time]);
  }
};



// Consolidated Exports
module.exports = {
  // Core
  init: initDB,
  initPromise,
  query,
  run: query,
  getOne,

  getSetting,
  setSetting,

  // Admins
  getAllAdmins,
  getAdminById,
  getAdminByUsername: async (username) => {
    if (type === 'pg') return await getOne("SELECT * FROM admins WHERE username = $1", [username]);
    return await getOne("SELECT * FROM admins WHERE username = ?", [username]);
  },
  createAdmin,
  checkAdminExists,
  updateAdminDaysOff,
  updateAdminPassword,
  updateAdminProfile,
  deleteAdmin,

  // Workers
  createWorker: createAdmin, // Alias
  getAdmin: findAdminInternal, // Restored to username lookup via internal function

  // Bookings
  createBooking,
  getBookingsForDate,

  getAppointmentsForWorker,
  deleteAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  anonymizePastAppointments,
  purgeOldAppointments,
  checkAppointmentConflicts,
  checkDaysOffConflicts,
  getDailyGaps,

  // Waiting List
  addWaitingListRequest,
  getPendingWaitingDates,
  getWaitingRequestsForDate,
  findNextWaitingRequest,
  updateWaitingRequestStatus,
  getWaitingRequestByToken,
  getExpiredOffers,
  getWaitingListCounts,

  // Cleanup feature
  expirePastWaitingRequests: async () => {
    const today = new Date().toISOString().split('T')[0];
    const sql = "UPDATE waiting_list_requests SET status = 'EXPIRED' WHERE target_date < ? AND status IN ('WAITING', 'OFFER_SENT')";

    if (type === 'pg') {
      return await query("UPDATE waiting_list_requests SET status = 'EXPIRED' WHERE target_date < $1 AND status IN ('WAITING', 'OFFER_SENT')", [today]);
    } else {
      return await query(sql, [today]);
    }
  },

  // Portfolio
  saveImage,
  getImage,
  deleteImage,
  createPortfolioItem,
  getPortfolioItemIds,
  getPortfolioItems,
  getPortfolioItemsByIds,
  deletePortfolioItem,

  // Auth / Tokens
  createResetToken,
  getResetToken,
  deleteResetToken,

  // Leaves
  getAllLeaves,
  addLeave: createLeave, // Alias
  createLeave,
  getLeaves,
  updateLeave,
  deleteLeave,

  // Legacy / Aliases (if needed)
};
