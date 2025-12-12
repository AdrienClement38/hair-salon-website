const app = require('./server/app');
const http = require('http');

// Export app for Vercel
module.exports = app;

// Start server if run directly (Local dev)
if (require.main === module) {
    const server = http.createServer(app);
    const port = process.env.PORT || 3000;

    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}
