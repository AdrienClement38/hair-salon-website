const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'salon.db');
const db = new Database(dbPath);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    service TEXT NOT NULL,
    phone TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, time)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Appointments
const getBookingsForDate = (date) => {
  const stmt = db.prepare('SELECT time FROM appointments WHERE date = ?');
  return stmt.all(date);
};

const getAllAppointments = () => {
  const stmt = db.prepare('SELECT * FROM appointments ORDER BY date DESC, time ASC');
  return stmt.all();
};

const createBooking = (name, date, time, service, phone) => {
  const stmt = db.prepare('INSERT INTO appointments (name, date, time, service, phone) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(name, date, time, service, phone);
};

const deleteAppointment = (id) => {
  const stmt = db.prepare('DELETE FROM appointments WHERE id = ?');
  return stmt.run(id);
};

const updateAppointment = (id, time) => {
  const stmt = db.prepare('UPDATE appointments SET time = ? WHERE id = ?');
  return stmt.run(time, id);
};

const anonymizePastAppointments = () => {
  const today = new Date().toISOString().split('T')[0];
  const stmt = db.prepare("UPDATE appointments SET phone = NULL WHERE date < ? AND phone IS NOT NULL");
  return stmt.run(today);
};

// Settings
const getSetting = (key) => {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key);
  return row ? JSON.parse(row.value) : null;
};

const setSetting = (key, value) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  return stmt.run(key, JSON.stringify(value));
};

module.exports = {
  getBookingsForDate,
  getAllAppointments,
  createBooking,
  deleteAppointment,
  updateAppointment,
  anonymizePastAppointments,
  getSetting,
  setSetting
};
