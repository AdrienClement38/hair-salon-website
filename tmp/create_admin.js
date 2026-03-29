
const db = require('../server/models/database');
const bcrypt = require('bcryptjs');

async function createTestAdmin() {
    try {
        const username = 'test_admin_verif';
        const password = 'password123';
        const hash = await bcrypt.hash(password, 10);
        await db.createAdmin(username, hash, 'Verification Admin');
        console.log('Admin created: test_admin_verif / password123');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

createTestAdmin();
