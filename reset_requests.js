
const db = require('./server/models/database');

(async () => {
    try {
        await new Promise(r => setTimeout(r, 1000));
        console.log('--- RESETTING EXPIRED REQUESTS ---');

        // Count expired first
        const expired = await db.run("SELECT * FROM waiting_list_requests WHERE target_date='2026-01-28' AND status='EXPIRED'");
        console.log(`Found ${expired.length} expired requests.`);

        if (expired.length > 0) {
            // Reset to WAITING
            await db.run("UPDATE waiting_list_requests SET status = 'WAITING', offer_expires_at = NULL, offer_token = NULL WHERE target_date='2026-01-28' AND status='EXPIRED'");
            console.log("Reset successfully.");
        } else {
            console.log("No expired requests to reset.");
        }
    } catch (e) {
        console.error(e);
    }
})();
