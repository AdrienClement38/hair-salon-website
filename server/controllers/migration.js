const db = require('../models/database');
const fs = require('fs');
const path = require('path');

exports.migrateImages = async (req, res) => {
    const outputDir = path.join(__dirname, '../../public/images/portfolio');

    // S'assurer que le dossier existe
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        console.log("Démarrage de la migration des images via API...");
        await db.initPromise;

        // 1. Récupérer toutes les images de la table
        // On utilise db.query qui va gérer SQLite ou PG automatiquement selon l'environnement
        let rows = [];
        // On fait une requête directe car getImage demande un filename
        if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
            // Environnement PG
            const res = await db.query('SELECT filename, data, mimetype FROM images');
            // db.query retourne soit un array (sqlite Select) soit le resultat complet PG pour Run,
            // mais database.js modifie le retour de PG pour les SELECT (retourne res.rows)
            rows = res;
        } else {
            rows = await db.query('SELECT filename, data, mimetype FROM images');
        }

        if (!rows || rows.length === 0) {
            return res.json({ success: true, message: "Aucune image trouvée dans la base de données.", count: 0 });
        }

        let extractedCount = 0;
        let errors = [];

        for (const row of rows) {
            try {
                const filename = row.filename;
                const data = row.data;
                let extension = '';

                if (row.mimetype === 'image/jpeg') extension = '.jpg';
                else if (row.mimetype === 'image/png') extension = '.png';
                else if (row.mimetype === 'image/webp') extension = '.webp';
                else if (!filename.includes('.')) extension = '.jpg'; // Fallback

                const finalFilename = filename.includes('.') ? filename : `${filename}${extension}`;
                const filePath = path.join(outputDir, finalFilename);

                fs.writeFileSync(filePath, data);
                extractedCount++;
                console.log(`Sauvegarde de ${finalFilename} OK.`);
            } catch (err) {
                console.error(`Erreur sur l'image ${row.filename}:`, err);
                errors.push(row.filename);
            }
        }

        res.json({
            success: true,
            message: "Migration terminée",
            count: extractedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error("Erreur critique lors de la migration :", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
