const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

async function resetPassword() {
    try {
        await db.initPromise;
        const admin = await db.getAdmin('admin');
        if (!admin) {
            console.error('User "admin" not found!');
            return;
        }

        const newPass = 'admin123';
        const hashedPassword = await bcrypt.hash(newPass, 10);

        await db.updateAdminPassword(admin.id, hashedPassword);
        console.log(`Password for user "admin" has been successfully reset to "${newPass}"`);

    } catch (e) {
        console.error('Error:', e);
    }
}

resetPassword();
