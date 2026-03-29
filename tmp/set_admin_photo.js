
const db = require('../server/models/database');

async function setAdminPhoto() {
    try {
        await db.updateAdminPhoto(1, 'test_avatar.png');
        console.log('Admin 1 photo set to test_avatar.png');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

setAdminPhoto();
