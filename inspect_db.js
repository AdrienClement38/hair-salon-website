
const db = require('./server/models/database');

(async () => {
    try {
        await new Promise(r => setTimeout(r, 1000));
        console.log('--- INSPECTION START ---');

        const requests = await db.run("SELECT * FROM waiting_list_requests WHERE target_date='2026-01-28'");
        console.log(`\nALL REQUESTS (${requests.length}):`);
        requests.forEach(r => {
            console.log(`- [#${r.id}] ${r.desired_service_id} Status: >${r.status}<`);
        });

    } catch (e) {
        console.error(e);
    }
})();
