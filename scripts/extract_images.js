const fs = require('fs');
const path = require('path');
const db = require('../server/models/database');

const outputDir = path.join(__dirname, '../public/images/portfolio');

// S'assurer que le dossier existe
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function extractImages() {
    console.log("Initialisation de la base de données...");
    try {
        await db.initPromise;

        console.log("Extraction des images depuis la table 'images'...");
        const rows = await db.query('SELECT filename, data, mimetype FROM images');
        console.log(`Trouvé ${rows.length} image(s) dans la base de données.`);

        for (const row of rows) {
            const filename = row.filename;
            const data = row.data;
            let extension = '';

            if (row.mimetype === 'image/jpeg') extension = '.jpg';
            else if (row.mimetype === 'image/png') extension = '.png';
            else if (row.mimetype === 'image/webp') extension = '.webp';
            else if (!filename.includes('.')) extension = '.jpg'; // Fallback

            const finalFilename = filename.includes('.') ? filename : `${filename}${extension}`;
            const filePath = path.join(outputDir, finalFilename);

            console.log(`Sauvegarde de ${finalFilename} (${Math.round(data.length / 1024)} Ko)...`);
            fs.writeFileSync(filePath, data);
        }

        console.log("Extraction terminée avec succès !");

    } catch (err) {
        console.error("Erreur lors de l'extraction :", err);
    }
}

extractImages();
