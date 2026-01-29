const db = require('../server/models/database');

async function debugGetLeaves() {
    await db.initPromise;

    console.log("--- Testing getLeaves(null, true) [Strict Global] ---");
    const globalLeaves = await db.getLeaves(null, true);
    console.log("Global Leaves Count:", globalLeaves.length);
    globalLeaves.forEach(l => {
        console.log(`Global Leave - ID: ${l.id}, AdminID: ${l.admin_id}`);
    });

    console.log("\n--- Testing getLeaves(1, true) [Strict Worker 1] ---");
    const workerLeaves = await db.getLeaves(1, true);
    console.log("Worker Leaves Count:", workerLeaves.length);
    workerLeaves.forEach(l => {
        console.log(`Worker Leave - ID: ${l.id}, AdminID: ${l.admin_id}`);
    });
}

debugGetLeaves();
