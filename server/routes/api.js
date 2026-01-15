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
const waitingListController = require('../controllers/waitingList');

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

const rateLimit = require('express-rate-limit');

// Specific Rate Limiter for Login
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Limit each IP to 5 failed requests per windowMs
    skipSuccessfulRequests: true, // Don't count successful logins
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de tentatives de connexions. Veuillez réessayer dans 10 minutes." }
});

// --- Auth Routes ---
router.get('/auth/status', authController.status);
router.post('/auth/setup', authController.setup);
router.post('/auth/login', loginLimiter, validate(loginSchema), authController.login);

// --- Password Reset ---
router.post('/auth/forgot-password', authController.requestPasswordReset);
router.get('/auth/verify-token/:token', authController.verifyResetToken);
router.post('/auth/reset-password', authController.resetPassword);

// --- Admin Auth/Profile ---
router.get('/admin/me', checkAuth, authController.me);
router.put('/admin/profile', checkAuth, authController.updateProfile);

// --- Workers Management (Admin) ---
router.get('/admin/workers', checkAuth, adminsController.listWorkers);
router.post('/admin/workers', checkAuth, validate(workerSchema), adminsController.createWorker);
router.put('/admin/workers/:id', checkAuth, validate(updateWorkerSchema), adminsController.updateWorker);
router.delete('/admin/workers/:id', checkAuth, adminsController.deleteWorker);
router.post('/admin/workers/check-days-off', checkAuth, adminsController.checkDaysOff);

// --- Appointments (Admin) ---
router.get('/admin/appointments', checkAuth, appointmentsController.list);
router.delete('/admin/appointments/:id', checkAuth, appointmentsController.delete);
router.put('/admin/appointments/:id', checkAuth, validate(updateBookingSchema), appointmentsController.update);

// --- Settings (Admin) ---
router.post('/admin/settings', checkAuth, settingsController.update);
router.get('/admin/settings', checkAuth, settingsController.get);
router.post('/admin/upload', checkAuth, upload.any(), settingsController.uploadImages);
router.post('/admin/settings/test-email', checkAuth, settingsController.testEmail);

// --- Leaves (Admin) ---
router.get('/admin/leaves', checkAuth, leavesController.list);
router.get('/admin/leaves/check', checkAuth, leavesController.check);
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

router.delete('/admin/portfolio/:id', checkAuth, portfolioController.delete);

// --- Waiting List ---
router.post('/waiting-list', waitingListController.join);
router.get('/waiting-list/claim', waitingListController.claim); // Returns HTML or Redirect
router.get('/waiting-list/details', waitingListController.getDetails); // JSON details for the claim page

// Admin Routes for Waiting List
router.get('/admin/waiting-list/counts', checkAuth, waitingListController.counts);
// router.get('/waiting-list/requests', checkAuth, waitingListController.list); // Let's use /requests for full list
router.get('/admin/waiting-list/requests', checkAuth, waitingListController.list);
router.post('/waiting-list/scan', checkAuth, waitingListController.scan);

router.post('/waiting-list/confirm', waitingListController.confirm);
router.post('/waiting-list/refuse', waitingListController.refuse);

module.exports = router;
