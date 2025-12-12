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
