const express = require('express');
const router = express.Router();
const multer = require('multer');

const authController = require('../controllers/auth');
const adminsController = require('../controllers/admins');
const appointmentsController = require('../controllers/appointments');
const leavesController = require('../controllers/leaves');
const settingsController = require('../controllers/settings');
const updatesController = require('../controllers/updates');
const portfolioController = require('../controllers/portfolio');
const checkAuth = require('../middleware/auth');
const validate = require('../middleware/validate');

// ... existing imports



const { createBookingSchema, updateBookingSchema } = require('../schemas/appointment');
const { loginSchema, workerSchema, updateWorkerSchema, leaveSchema } = require('../schemas/admin');

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Strict allow list for mime types
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            // Reject file
            cb(new Error('Format invalide (JPG, PNG, WEBP uniquement)'));
        }
    }
});

// --- Auth Routes ---
router.get('/auth/status', authController.status);
router.post('/auth/setup', authController.setup); // Setup might need schema too, but usually one-off
router.post('/auth/login', validate(loginSchema), authController.login);

// --- Admin Auth/Profile ---
router.get('/admin/me', checkAuth, authController.me);
router.put('/admin/profile', checkAuth, authController.updateProfile);

// --- Workers Management (Admin) ---
router.get('/admin/workers', checkAuth, adminsController.listWorkers);
router.post('/admin/workers', checkAuth, validate(workerSchema), adminsController.createWorker);
router.put('/admin/workers/:id', checkAuth, validate(updateWorkerSchema), adminsController.updateWorker);

// --- Appointments (Admin) ---
router.get('/admin/appointments', checkAuth, appointmentsController.list);
router.delete('/admin/appointments/:id', checkAuth, appointmentsController.delete);
router.put('/admin/appointments/:id', checkAuth, validate(updateBookingSchema), appointmentsController.update);

// --- Settings (Admin) ---
router.post('/admin/settings', checkAuth, settingsController.update);
router.get('/admin/settings', checkAuth, settingsController.get);
router.post('/admin/upload', checkAuth, upload.fields([{ name: 'hero-bg' }, { name: 'philosophy-bg' }]), settingsController.uploadImages);

// --- Leaves (Admin) ---
router.get('/admin/leaves', checkAuth, leavesController.list);
router.post('/admin/leaves', checkAuth, validate(leaveSchema), leavesController.create);
router.delete('/admin/leaves/:id', checkAuth, leavesController.delete);

// --- Public Data ---
router.get('/workers', adminsController.listPublicWorkers);
router.get('/settings', settingsController.get);
router.get('/slots', appointmentsController.getSlots);
router.post('/book', validate(createBookingSchema), appointmentsController.createBooking);

// --- Updates (Polling) ---
router.get('/updates', updatesController.checkUpdates);

// --- Portfolio ---
router.get('/portfolio', portfolioController.list);
router.get('/admin/portfolio', portfolioController.list); // Add this alias for keys in Admin UI
router.post('/admin/portfolio', checkAuth, upload.single('image'), portfolioController.create);
router.delete('/admin/portfolio/:id', checkAuth, portfolioController.delete);

module.exports = router;
