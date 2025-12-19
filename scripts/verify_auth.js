const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

async function verify() {
    console.log("Initializing DB...");
    await db.initPromise;
    console.log("DB type:", db.type);

    const exists = await db.checkAdminExists();
    console.log("Admin exists:", exists);

    if (exists) {
        const admin = await db.getAdmin('admin'); // Assuming default user is 'admin'
        if (admin) {
            console.log("Admin user found:", admin.username);
            console.log("Display Name:", admin.display_name);
            console.log("Hash:", admin.password_hash);
            
            // Test strict comparison with "admin" (default password often used)
            const match = await bcrypt.compare('admin', admin.password_hash);
            console.log("Password 'admin' valid:", match);
        } else {
            console.log("Admin user 'admin' not found, listing all admins...");
            const all = await db.getAllAdmins();
            console.log(all);
        }
    }
}

verify().catch(console.error);
