const waitingListService = require('./waitingListService');

class CronService {
    start() {
        console.log('[Cron] Service started.');

        // Initial Scan on startup (Wait 5s for DB)
        setTimeout(() => {
            waitingListService.scanWaitlist();
        }, 5000);

        // Check for waitlist timeouts every minute
        setInterval(async () => {
            try {
                await waitingListService.handleTimeouts();
            } catch (e) {
                console.error('[Cron] Error handling timeouts:', e);
            }
        }, 60 * 1000);

        // Scan Waitlist every 30 minutes for missed gaps
        setInterval(async () => {
            try {
                await waitingListService.scanWaitlist();
            } catch (e) {
                console.error('[Cron] Error scanning waitlist:', e);
            }
        }, 30 * 60 * 1000);
    }
}

module.exports = new CronService();
