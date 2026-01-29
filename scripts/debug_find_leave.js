const db = require('../server/models/database');

async function findLeavesByDate() {
    await db.initPromise;
    const leaves = await db.getAllLeaves();
    const targeted = leaves.filter(l => l.start_date === '2026-02-16');
    console.log('Leaves starting 2026-02-16:');
    targeted.forEach(l => {
        console.log(`ID: ${l.id}, AdminID: ${l.admin_id}, Note: ${l.note}`);
    });
}

findLeavesByDate();
