const db = require('../server/models/database');

async function checkUsers() {
    await db.initPromise;
    const admins = await db.getAllAdmins();
    console.log(JSON.stringify(admins, null, 2));
}

checkUsers();
