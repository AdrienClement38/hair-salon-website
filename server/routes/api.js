const express = require('express');
const router = express.Router();
const multer = require('multer');

const authController = require('../controllers/auth');
const adminsController = require('../controllers/admins');
const appointmentsController = require('../controllers/appointments');
const leavesController = require('../controllers/leaves');
const settingsController = require('../controllers/settings');
const updatesController = require('../controllers/updates');
const checkAuth = require('../middleware/auth');
const validate = require('../middleware/validate');

// ... existing imports



const { createBookingSchema, updateBookingSchema } = require('../schemas/appointment');

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Auth Routes ---
router.get('/auth/status', authController.status);
router.post('/auth/setup', authController.setup);
router.post('/auth/login', authController.login);

// --- Admin Auth/Profile ---
router.get('/admin/me', checkAuth, authController.me);
router.put('/admin/profile', checkAuth, authController.updateProfile);

// --- Workers Management (Admin) ---
router.get('/admin/workers', checkAuth, adminsController.listWorkers);
router.post('/admin/workers', checkAuth, adminsController.createWorker);

// --- Appointments (Admin) ---
router.get('/admin/appointments', checkAuth, appointmentsController.list);
router.delete('/admin/appointments/:id', checkAuth, appointmentsController.delete);
router.put('/admin/appointments/:id', checkAuth, validate(updateBookingSchema), appointmentsController.update);

// --- Settings (Admin) ---
router.post('/admin/settings', checkAuth, settingsController.update);
router.get('/admin/settings', checkAuth, settingsController.get);
router.post('/admin/upload', checkAuth, upload.any(), settingsController.uploadImages);

// --- Leaves (Admin) ---
router.get('/admin/leaves', checkAuth, leavesController.list);
router.post('/admin/leaves', checkAuth, leavesController.create);
router.delete('/admin/leaves/:id', checkAuth, leavesController.delete);

// --- Public Data ---
router.get('/workers', adminsController.listPublicWorkers);
router.get('/settings', settingsController.get);
router.get('/slots', appointmentsController.getSlots);
router.post('/book', validate(createBookingSchema), appointmentsController.createBooking);

// --- Updates (Polling) ---
router.get('/updates', updatesController.checkUpdates);

module.exports = router;
