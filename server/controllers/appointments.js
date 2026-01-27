const db = require('../models/database');
const { triggerUpdate } = require('../config/polling');
const appointmentService = require('../services/appointmentService');
const waitingListService = require('../services/waitingListService');

exports.list = async (req, res) => {
    const { adminId } = req.query;
    try {
        await db.anonymizePastAppointments();
        const appointments = await db.getAllAppointments(adminId);
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const { sendEmail } = req.body;
        const id = req.params.id;

        const result = await appointmentService.cancelAppointment(id, {
            source: 'admin',
            reason: 'Annulation manuelle par le salon',
            sendEmail: !!sendEmail
        });

        if (!result.success && result.message === 'Appointment not found') {
            // Treat as success (idempotent) or 404? 
            // Admin UI expects success mainly.
            console.warn(`Attempted to delete non-existent appointment ${id}`);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete Error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.update = async (req, res) => {
    const { time } = req.body;
    try {
        await db.updateAppointment(req.params.id, time);
        triggerUpdate();
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key')) {
            res.status(409).json({ error: 'Slot already taken' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
};

exports.createBooking = async (req, res) => {
    try {
        // Validation now handled by middleware
        // Pass email if present
        const result = await appointmentService.createBooking(req.body);

        // Send Email Confirmation (Fire and Forget)
        const emailService = require('../services/emailService');
        // We need the worker's name. createBooking returns ID.
        // req.body has adminId, service, date, time, name.
        // We need to resolve worker name if possible, or pass adminId for the service to look up?
        // emailService.sendConfirmation expects workerName.
        // Let's look it up quickly or pass what we have.
        // Ideally AppointmentService returns the enriched booking or we duplicate logic.
        // Simplest: Fetch worker name here or let EmailService handle it?
        // EmailService generates HTML, so it needs the name. 
        // Let's just fetch it here or modify req.body if it came from frontend (it usually doesn't send worker NAME, just ID).
        // Actually, let's fetch the admin to get the display name.
        const db = require('../models/database');
        let workerName = 'Le Coiffeur';
        if (req.body.adminId) {
            const admin = await db.getAdminById(req.body.adminId);
            if (admin) workerName = admin.display_name || admin.username;
        }

        emailService.sendConfirmation({
            ...req.body,
            to: req.body.email,
            id: result.lastInsertRowid, // Pass ID for cancellation link
            workerName
        }).catch(err => console.error("Email send failed", err));

        triggerUpdate();
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.message === 'Slot already booked' || err.message === 'Slot already booked or overlaps') {
            return res.status(409).json({ error: err.message });
        }
        console.error('[CreateBooking Error]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getSlots = async (req, res) => {
    const { date, adminId, serviceId } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    try {
        const slots = await appointmentService.getAvailableSlots(date, adminId, serviceId);
        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.cancelConfirm = async (req, res) => {
    const { id, token } = req.query;
    if (!id || !token) return res.status(400).send('Lien invalide');

    try {
        const appointment = await db.getAppointmentById(id);
        if (!appointment) return res.status(404).send('Rendez-vous introuvable ou déjà annulé.');

        // Verify Token
        const emailService = require('../services/emailService');
        const expectedToken = emailService.generateCancellationToken(appointment);

        if (token !== expectedToken) {
            return res.status(403).send('Lien invalide ou expiré.');
        }

        // Render Confirmation Page
        // Ideally we use a template engine, but simple HTML send is fine for this task.
        const dateStr = new Date(appointment.date).toLocaleDateString('fr-FR');

        const html = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Confirmation d'annulation</title>
                <style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f5f5f5; margin: 0; }
                    .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
                    .btn { background-color: #d32f2f; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; text-decoration: none; display: inline-block; margin-top: 20px; }
                    .btn:hover { background-color: #b71c1c; }
                    .info { margin: 20px 0; background: #fff3f3; padding: 10px; border-radius: 4px; color: #b71c1c; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Annuler le rendez-vous ?</h2>
                    <p>Vous êtes sur le point d'annuler votre rendez-vous :</p>
                    <div class="info">
                        <strong>${appointment.service}</strong><br>
                        ${dateStr} à ${appointment.time}
                    </div>
                    <p>Cette action est irréversible.</p>
                    
                    <form action="/api/appointments/cancel-client" method="POST">
                        <input type="hidden" name="id" value="${id}">
                        <input type="hidden" name="token" value="${token}">
                        <button type="submit" class="btn">Confirmer l'abandon</button>
                    </form>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    } catch (err) {
        console.error('Cancel Page Error:', err);
        res.status(500).send('Erreur interne');
    }
};

exports.cancelClient = async (req, res) => {
    const { id, token } = req.body;
    if (!id || !token) return res.status(400).json({ error: 'Données manquantes' });

    try {
        const appointment = await db.getAppointmentById(id);
        if (!appointment) return res.status(404).send('Rendez-vous introuvable ou déjà annulé.');

        // Verify Token Again
        const emailService = require('../services/emailService');
        const expectedToken = emailService.generateCancellationToken(appointment);

        if (token !== expectedToken) {
            return res.status(403).send('Jeton invalide.');
        }

        // Perform Cancellation
        await appointmentService.cancelAppointment(id, {
            source: 'client',
            reason: 'Annulé par le client',
            sendEmail: false // Don't spam them back, they just clicked.
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Annulation confirmée</title>
                <style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f5f5f5; margin: 0; }
                    .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
                    .success { color: #2e7d32; font-size: 48px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="success">✓</div>
                    <h2>Rendez-vous annulé</h2>
                    <p>Votre rendez-vous a bien été annulé.</p>
                    <p>Une place a peut-être été libérée pour un autre client.</p>
                    <p style="margin-top: 30px;"><a href="/" style="color: #333;">Retour à l'accueil</a></p>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Client Cancel Error:', err);
        res.status(500).send('Erreur lors de l\'annulation');
    }
};
