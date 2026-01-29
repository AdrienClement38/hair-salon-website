const db = require('../server/models/database');

async function checkLatestLeaves() {
    await db.initPromise;
    // Get all leaves
    const leaves = await db.getAllLeaves();
    // Sort by ID desc
    leaves.sort((a, b) => b.id - a.id);

    console.log('Top 5 Latest Leaves:');
    leaves.slice(0, 5).forEach(l => {
        console.log(`ID: ${l.id}, AdminID: ${l.admin_id} (${typeof l.admin_id}), Start: ${l.start_date}, End: ${l.end_date}, Note: ${l.note}`);
    });
}

checkLatestLeaves();
