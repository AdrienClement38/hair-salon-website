const app = require('./server/app');
const http = require('http');

// Export app for Vercel
module.exports = app;

// Start server if run directly (Local dev)
if (require.main === module) {
    const server = http.createServer(app);
    const port = process.env.PORT || 3000;

    const db = require('./server/models/database');

    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);

        // Trigger Database Cleanup on Start
        db.initPromise.then(() => {
            db.purgeOldAppointments()
            // Start Cron Service
            const cronService = require('./server/services/cronService');
            cronService.start();
        });
    });
}
