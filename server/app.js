const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const apiRoutes = require('./routes/api');
const settingsController = require('./controllers/settings');

const app = express();

// Security Headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now to avoid breaking inline scripts if not ready
    crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// Prevent HTTP Parameter Pollution
app.use(hpp());

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*', // Restrict in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

const cookieParser = require('cookie-parser');
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Handle form submissions
app.use(express.static(path.join(__dirname, '../public')));

// Disable caching for API routes
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// API Routes
app.use('/api', apiRoutes);

// Image Serving (Root level)
app.get('/images/:filename', settingsController.serveImage);

// Serve Admin Page (Explicit route or rely on static?)
// Static logic in server.js was: app.get('/admin', sendFile admin.html)
app.get('/lbc-admin', (req, res) => {
    res.sendFile('admin.html', { root: path.join(__dirname, '../public') });
});

module.exports = app;
