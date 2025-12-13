const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const settingsController = require('./controllers/settings');

const app = express();

app.use(cors());
app.use(bodyParser.json());
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
app.get('/admin', (req, res) => {
    res.sendFile('admin.html', { root: path.join(__dirname, '../public') });
});

module.exports = app;
