
const db = require('../server/models/database');

async function checkAdmins() {
    try {
        const admins = await db.getAllAdmins();
        console.log('Admins found:', JSON.stringify(admins, null, 2));
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

checkAdmins();
