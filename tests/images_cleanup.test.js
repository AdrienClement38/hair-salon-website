const db = require('../server/models/database');
const request = require('supertest');
const app = require('../server/app');

describe('Image Cleanup Logic', () => {

    beforeAll(async () => {
        await db.initPromise;
        const hash = await require('bcryptjs').hash('password', 10);
        await db.createAdmin('img_cleaner', hash, 'Cleaner');
    });

    test('Unit: deleteImage should remove image from DB', async () => {
        const testImg = 'unit_test_img_' + Date.now();
        await db.saveImage(testImg, Buffer.from('test'), 'image/png');
        expect(await db.getImage(testImg)).toBeTruthy();

        await db.deleteImage(testImg);
        expect(await db.getImage(testImg)).toBeFalsy();
    });

    test('Should delete orphan images when Product is deleted OR updated', async () => {
        const authHeader = 'Basic ' + Buffer.from('img_cleaner:password').toString('base64');

        // SETUP
        const imgName = 'img_to_delete_' + Date.now();
        const keptImgName = 'img_to_keep_' + Date.now();

        await db.saveImage(imgName, Buffer.from('fake'), 'image/png');
        await db.saveImage(keptImgName, Buffer.from('fake_keep'), 'image/png');

        const initialProducts = [
            { id: 1, name: 'Prod A', price: 10, image: imgName },
            { id: 2, name: 'Prod B', price: 20, image: keptImgName }
        ];

        await request(app).post('/api/admin/settings')
            .set('Authorization', authHeader)
            .set('Content-Type', 'application/json')
            .send({ products: initialProducts });

        expect(await db.getImage(imgName)).toBeTruthy();

        // ACTION: Update
        const newImgName = 'img_new_' + Date.now();
        await db.saveImage(newImgName, Buffer.from('new'), 'image/png');

        const newProducts = [
            { id: 1, name: 'Prod A', price: 10, image: newImgName }, // Replaced
            { id: 2, name: 'Prod B', price: 20, image: keptImgName }
        ];

        const res = await request(app).post('/api/admin/settings')
            .set('Authorization', authHeader)
            .set('Content-Type', 'application/json')
            .send({ products: newProducts });

        expect(res.statusCode).toBe(200);

        // CHECK
        const deletedImg = await db.getImage(imgName);
        if (deletedImg) console.log("FAILURE LOG: Old image still exists");
        expect(deletedImg).toBeFalsy();

        expect(await db.getImage(keptImgName)).toBeTruthy();
        expect(await db.getImage(newImgName)).toBeTruthy();
    });
});
