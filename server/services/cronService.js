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

        // Daily Cleanup of Old Leaves/Holidays (Every 24 hours)
        const runDailyCleanup = async () => {
            try {
                const db = require('../models/database');
                
                // 1. Purge Old Leaves
                const resLeaves = await db.purgeOldLeaves();
                if (resLeaves && resLeaves.changes > 0) {
                    console.log(`[Cron] Daily cleanup: Removed ${resLeaves.changes} past holidays.`);
                }
                
                // 2. Anonymize Past Appointments (Remove Phone numbers from yesterday to protect privacy)
                const resAnon = await db.anonymizePastAppointments();
                if (resAnon && resAnon.changes > 0) {
                    console.log(`[Cron] Daily privacy check: Anonymized ${resAnon.changes} past appointments.`);
                }

                // 3. Purge Old Appointments (Keep 7 days of history by default, delete older)
                const resAppts = await db.purgeOldAppointments(7);
                if (resAppts && resAppts.changes > 0) {
                    console.log(`[Cron] Daily cleanup: Removed ${resAppts.changes} old appointments (> 7 days).`);
                }

                // 4. Purge Old Waiting List Requests
                const resWaitlist = await db.purgeOldWaitingRequests();
                if (resWaitlist && resWaitlist.changes > 0) {
                    console.log(`[Cron] Daily cleanup: Removed ${resWaitlist.changes} past waiting list requests.`);
                }
            } catch (e) {
                console.error('[Cron] Error running daily cleanup:', e);
            }
        };

        const ONE_DAY = 24 * 60 * 60 * 1000;
        
        // Run immediately on startup (Wait 1s for DB init)
        setTimeout(() => {
            runDailyCleanup();
        }, 1000);

        // Then run every 24 hours
        setInterval(runDailyCleanup, ONE_DAY);
    }
}

module.exports = new CronService();
