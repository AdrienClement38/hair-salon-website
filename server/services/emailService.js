const nodemailer = require('nodemailer');
const db = require('../models/database');

class EmailService {

    /**
     * Test email configuration
     * @param {Object} config - { user, pass }
     */
    async testConnection(config) {
        if (!config || !config.user || !config.pass) {
            throw new Error('Configuration manquante');
        }

        const host = config.host || 'smtp.gmail.com';
        const port = config.port || 465;
        const secure = port == 465;

        const transportConfig = {
            host,
            port,
            secure,
            auth: {
                user: config.user,
                pass: config.pass
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            family: 4 // Force IPv4 to avoid socket close issues
        };

        const transporter = nodemailer.createTransport(transportConfig);

        const mailOptions = {
            from: `"Test La Base" <${config.user}>`,
            to: config.user, // Send to self
            subject: 'Test de Configuration Email - La Base Coiffure',
            text: 'Ceci est un email de test pour confirmer que la configuration SMTP fonctionne correctement.'
        };

        if (process.env.NODE_ENV === 'test') {
            console.log('[EmailService] TEST MODE: Email suppressed', mailOptions);
            return true;
        }

        await transporter.sendMail(mailOptions);
        return true;
    }

    /**
     * Send booking confirmation email with ICS attachment
     * @param {Object} data - { to, name, date, time, service, workerName, phone? }
     */
    async sendConfirmation(data) {
        if (!data.to) {
            console.warn('EmailService: No "to" address provided in data:', data);
            return;
        }

        const config = await db.getSetting('email_config');

        let settings;
        try {
            settings = typeof config === 'string' ? JSON.parse(config) : config;
        } catch (e) {
            settings = null;
        }

        if (!settings || !settings.user || !settings.pass) {
            console.warn('EmailService: No email configuration found/valid. Config:', config);
            return;
        }

        // Generic SMTP Transport
        const host = settings.host || 'smtp.gmail.com';
        const port = settings.port || 465;
        const secure = port == 465;

        const transportConfig = {
            host,
            port,
            secure,
            auth: {
                user: settings.user,
                pass: settings.pass
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            family: 4 // Force IPv4
        };

        const transporter = nodemailer.createTransport(transportConfig);

        const { name, date, time, service, workerName } = data;

        // Generate ICS content
        const icsContent = this.generateICS(data);

        const mailOptions = {
            from: `"La Base Coiffure" <${settings.user}>`,
            to: data.to,
            subject: 'Confirmation de votre Rendez-vous - La Base Coiffure',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Bonjour ${name},</h2>
                    <p>Votre rendez-vous est confirmé !</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Prestation :</strong> ${service}</p>
                        <p style="margin: 5px 0;"><strong>Coiffeur :</strong> ${workerName}</p>
                        <p style="margin: 5px 0;"><strong>Date :</strong> ${date}</p>
                        <p style="margin: 5px 0;"><strong>Heure :</strong> ${time}</p>
                    </div>

                    <p>Vous pouvez ajouter ce rendez-vous à votre calendrier en utilisant le fichier joint ou le bouton ci-dessous (si supporté par votre messagerie).</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #777;">La Base Coiffure<br>Ceci est un message automatique, merci de ne pas répondre.</p>
                </div>
            `,
            attachments: [
                {
                    filename: 'invite.ics',
                    content: icsContent,
                    contentType: 'text/calendar'
                }
            ]
        };

        try {
            if (process.env.NODE_ENV === 'test') {
                console.log(`[EmailService] TEST MODE: Email suppressed to ${data.to}`);
            } else {
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${data.to}`);
            }
        } catch (error) {
            console.error('EmailService Error:', error);
            // Don't throw, we don't want to break the booking flow if email fails
        }
    }
    /**
     * Generate secure cancellation token
     */
    generateCancellationToken(appointment) {
        const crypto = require('crypto');
        const secret = process.env.JWT_SECRET || 'fallback_secret_should_be_changed';

        // Data to sign: ID + Date + Time (ensures link invalid if rescheduled?) 
        // Or just ID + CreatedAt. Simple: ID + Secret + App specific salt.
        const payload = `${appointment.id}:${appointment.email}:${secret}`;
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }

    /**
     * Send booking confirmation email with ICS attachment
     * @param {Object} data - { to, name, date, time, service, workerName, phone?, id? }
     */
    async sendConfirmation(data) {
        if (!data.to) {
            console.warn('EmailService: No "to" address provided in data:', data);
            return;
        }

        const config = await db.getSetting('email_config');

        let settings;
        try {
            settings = typeof config === 'string' ? JSON.parse(config) : config;
        } catch (e) {
            settings = null;
        }

        if (!settings || !settings.user || !settings.pass) {
            console.warn('EmailService: No email configuration found/valid. Config:', config);
            return;
        }

        // Generic SMTP Transport
        const host = settings.host || 'smtp.gmail.com';
        const port = settings.port || 465;
        const secure = port == 465;

        const transportConfig = {
            host,
            port,
            secure,
            auth: {
                user: settings.user,
                pass: settings.pass
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            family: 4 // Force IPv4
        };

        const transporter = nodemailer.createTransport(transportConfig);

        const { name, date, time, service, workerName, id, email } = data;

        // Generate ICS content
        const icsContent = this.generateICS(data);

        // Generate Cancellation Link
        // We need appointment ID. If not passed (legacy calls), we can't generate it.
        // Assuming createBooking passes it now (we need to verify controller updates).
        let cancellationHtml = '';
        if (id) {
            const token = this.generateCancellationToken({ id, email: data.to }); // use data.to as email source
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const cancelLink = `${baseUrl}/api/appointments/cancel-confirm?id=${id}&token=${token}`;

            cancellationHtml = `
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc; text-align: center;">
                    <p style="font-size: 14px; color: #555;">En cas d'imprévu, vous pouvez annuler votre rendez-vous ci-dessous :</p>
                    <a href="${cancelLink}" style="color: #d32f2f; text-decoration: underline; font-size: 14px;">Annuler ce rendez-vous</a>
                </div>
            `;
        }

        const mailOptions = {
            from: `"La Base Coiffure" <${settings.user}>`,
            to: data.to,
            subject: 'Confirmation de votre Rendez-vous - La Base Coiffure',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Bonjour ${name},</h2>
                    <p>Votre rendez-vous est confirmé !</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Prestation :</strong> ${service}</p>
                        <p style="margin: 5px 0;"><strong>Coiffeur :</strong> ${workerName}</p>
                        <p style="margin: 5px 0;"><strong>Date :</strong> ${date}</p>
                        <p style="margin: 5px 0;"><strong>Heure :</strong> ${time}</p>
                    </div>

                    <p>Vous pouvez ajouter ce rendez-vous à votre calendrier en utilisant le fichier joint ou le bouton ci-dessous (si supporté par votre messagerie).</p>
                    
                    ${cancellationHtml}

                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #777;">La Base Coiffure<br>Ceci est un message automatique, merci de ne pas répondre.</p>
                </div>
            `,
            attachments: [
                {
                    filename: 'invite.ics',
                    content: icsContent,
                    contentType: 'text/calendar'
                }
            ]
        };

        try {
            if (process.env.NODE_ENV === 'test') {
                console.log(`[EmailService] TEST MODE: Email suppressed to ${data.to}`);
            } else {
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${data.to}`);
            }
        } catch (error) {
            console.error('EmailService Error:', error);
            // Don't throw, we don't want to break the booking flow if email fails
        }
    }
    /**
     * Send password reset link
     * @param {string} to - Recipient email
     * @param {string} resetLink - The full reset URL
     */
    async sendPasswordReset(to, resetLink) {
        if (!to) {
            console.warn('EmailService: No "to" address provided for password reset');
            return;
        }

        const config = await db.getSetting('email_config');
        let settings;
        try {
            settings = typeof config === 'string' ? JSON.parse(config) : config;
        } catch (e) {
            settings = null;
        }

        if (!settings || !settings.user || !settings.pass) {
            console.warn('EmailService: No email configuration found for reset.');
            return; // Fail silently or warn? Controller handles generic success message.
        }

        const transportConfig = {
            host: settings.host || 'smtp.gmail.com',
            port: settings.port || 465,
            secure: (settings.port || 465) == 465,
            auth: { user: settings.user, pass: settings.pass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            family: 4
        };

        const transporter = nodemailer.createTransport(transportConfig);

        const mailOptions = {
            from: `"La Base Coiffure" <${settings.user}>`,
            to: to,
            subject: 'Réinitialisation de mot de passe - La Base Coiffure',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Réinitialisation de mot de passe</h2>
                    <p>Une demande de réinitialisation de mot de passe a été effectuée.</p>
                    <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Réinitialiser mon mot de passe</a>
                    </p>
                    <p>Ou copiez ce lien : <br> ${resetLink}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #777;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                </div>
            `
        };

        try {
            if (process.env.NODE_ENV === 'test') {
                console.log(`[EmailService] TEST MODE: Email suppressed to ${to}`);
            } else {
                await transporter.sendMail(mailOptions);
                console.log(`Reset email sent to ${to}`);
            }
        } catch (error) {
            console.error('EmailService Reset Error:', error);
            throw error; // Re-throw for controller to handle logging if needed
        }
    }

    generateICS(data) {
        const { date, time, service, workerName } = data;

        // Calculate Start/End Date objects
        // Assumption: Service takes 30 mins default if not specified (or passed in data).
        // Ideally data should contain duration.
        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);

        const startDate = new Date(year, month - 1, day, hour, minute);
        const endDate = new Date(startDate);
        endDate.setMinutes(startDate.getMinutes() + 30); // Default duration

        // Format Date for ICS: YYYYMMDDTHHMMSS
        const formatICSDate = (d) => {
            return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const now = new Date();
        const stamp = formatICSDate(now);
        const start = formatICSDate(startDate);
        const end = formatICSDate(endDate);

        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LaBaseCoiffure//Booking//FR
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}@labasecoiffure.com
DTSTAMP:${stamp}
DTSTART:${start}
DTEND:${end}
SUMMARY:Rendez-vous Coiffeur - ${service} avec ${workerName}
DESCRIPTION:Rendez-vous confirmé pour ${service} avec ${workerName}.
LOCATION:La Base Coiffure
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '\r\n');
    }

    /**
     * Send cancellation email
     * @param {Object} appointment - { email, name, date, time, service, worker_name }
     * @param {Object} context - { reason, workerName }
     */
    async sendCancellation(appointment, context) {
        if (!appointment.email) return;

        const config = await db.getSetting('email_config');
        let settings;
        try {
            settings = typeof config === 'string' ? JSON.parse(config) : config;
        } catch (e) {
            settings = null;
        }

        if (!settings || !settings.user || !settings.pass) {
            console.warn('EmailService: No email configuration found for cancellation.');
            return;
        }

        const transportConfig = {
            host: settings.host || 'smtp.gmail.com',
            port: settings.port || 465,
            secure: (settings.port || 465) == 465,
            auth: { user: settings.user, pass: settings.pass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            family: 4
        };

        const transporter = nodemailer.createTransport(transportConfig);

        // Format date common usage
        const dateObj = new Date(appointment.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const mailOptions = {
            from: `"La Base Coiffure" <${settings.user}>`,
            to: appointment.email,
            subject: 'Annulation de votre Rendez-vous - La Base Coiffure',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d32f2f;">Rendez-vous Annulé</h2>
                    <p>Bonjour ${appointment.name},</p>
                    <p>Nous sommes au regret de vous informer que votre rendez-vous a dû être annulé.</p>
                    
                    <div style="background-color: #fff3f3; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #d32f2f;">
                        <p style="margin: 5px 0;"><strong>Date :</strong> ${dateStr}</p>
                        <p style="margin: 5px 0;"><strong>Heure :</strong> ${appointment.time}</p>
                        <p style="margin: 5px 0;"><strong>Raison :</strong> ${context.reason}</p>
                    </div>

                    <p>Si l'annulation n'est pas de votre initiative, nous vous invitons à reprendre rendez-vous sur notre site ou à nous contacter pour plus d'informations.</p>
                    <p>Veuillez nous excuser pour ce désagrément.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #777;">La Base Coiffure<br>Ref: ${Date.now().toString().slice(-6)}</p>
                </div>
            `
        };

        try {
            if (process.env.NODE_ENV === 'test') {
                console.log(`[EmailService] TEST MODE: Email suppressed to ${appointment.email}`);
            } else {
                await transporter.sendMail(mailOptions);
                console.log(`Cancellation email sent to ${appointment.email}`);
            }
        } catch (error) {
            console.error('EmailService Cancellation Error:', error);
        }
    }

    /**
     * Send confirmation of joining waiting list
     */
    async sendWaitlistJoin(to, name, date, serviceId, workerId) {
        if (!to) return;

        // Helper to get transport... DRY this up?
        // Copy-paste for stability now.
        const config = await db.getSetting('email_config');
        let settings;
        try { settings = typeof config === 'string' ? JSON.parse(config) : config; } catch (e) { settings = null; }
        if (!settings || !settings.user || !settings.pass) return;

        // Resolve Service Name & Duration
        let serviceName = 'Prestation indéfinie';
        let serviceDuration = '?';
        try {
            const servicesConfig = await db.getSetting('services');
            const services = typeof servicesConfig === 'string' ? JSON.parse(servicesConfig) : servicesConfig;
            if (Array.isArray(services)) {
                // Support Name OR ID because frontend sends Name
                const svc = services.find(s => s.id == serviceId || s.name === serviceId);
                if (svc) {
                    serviceName = svc.name;
                    serviceDuration = svc.duration + ' min';
                } else if (typeof serviceId === 'string' && serviceId.length > 0 && !serviceId.startsWith('svc-')) {
                    serviceName = serviceId;
                }
            }
        } catch (e) { console.warn('EmailService: Failed to resolve service name', e); }

        // Resolve Worker Name
        let workerName = 'Indifférent';
        if (workerId && workerId != 1) { // Assuming 1 is "Any/Salon" or check valid ID
            try {
                // We can't easily access admins table from here without model, 
                // but we can try getAdminById from db model if available or query directly.
                // emailService requires db model at top? Yes `const db = require('../models/database');`
                const worker = await db.getAdminById(workerId);
                if (worker) workerName = worker.display_name || worker.username;
            } catch (e) { console.warn('EmailService: Failed to resolve worker name', e); }
        }

        const transportConfig = {
            host: settings.host || 'smtp.gmail.com',
            port: settings.port || 465,
            secure: (settings.port || 465) == 465,
            auth: { user: settings.user, pass: settings.pass },
            tls: { rejectUnauthorized: false }, family: 4
        };
        const transporter = nodemailer.createTransport(transportConfig);

        const mailOptions = {
            from: `"La Base Coiffure" <${settings.user}>`,
            to: to,
            subject: 'Liste d\'attente - Confirmation',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Vous êtes sur liste d'attente 🕒</h2>
                    <p>Bonjour ${name},</p>
                    <p>Nous avons bien noté votre souhait de rendez-vous pour le <strong>${date.split('-').reverse().join('/')}</strong>.</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Prestation :</strong> ${serviceName}</p>
                        <p style="margin: 5px 0;"><strong>Durée estimate :</strong> ${serviceDuration}</p>
                        <p style="margin: 5px 0;"><strong>Coiffeur souhaité :</strong> ${workerName}</p>
                    </div>

                    <p>Si un créneau se libère, vous recevrez immédiatement un email pour vous le proposer.</p>
                    <p><strong>⚠️ Attention :</strong> Vous aurez alors <strong>20 minutes</strong> pour confirmer votre réservation via le lien reçu, sinon le créneau sera proposé à la personne suivante.</p>
                    <p>Soyez réactif, les places partent vite !</p>
                    <p><small>(Vous n'avez rien d'autre à faire pour l'instant).</small></p>
                </div>
            `
        };

        if (process.env.NODE_ENV === 'test') {
            console.log(`[EmailService] TEST MODE: Email suppressed to ${to}`);
            return;
        }

        await transporter.sendMail(mailOptions);
    }

    /**
     * Send Offer (Golden Ticket)
     */
    /**
     * Send Offer (Golden Ticket)
     */
    async sendSlotOffer(to, name, date, time, token, serviceId, workerId) {
        if (!to) return;
        const config = await db.getSetting('email_config');
        let settings;
        try { settings = typeof config === 'string' ? JSON.parse(config) : config; } catch (e) { settings = null; }
        if (!settings || !settings.user || !settings.pass) return;

        // Resolve Service Name & Duration
        let serviceName = 'Prestation indéfinie';
        let serviceDuration = '?';
        try {
            const servicesConfig = await db.getSetting('services');
            const services = typeof servicesConfig === 'string' ? JSON.parse(servicesConfig) : servicesConfig;
            if (Array.isArray(services)) {
                // Support Name OR ID
                const svc = services.find(s => s.id == serviceId || s.name === serviceId);
                if (svc) {
                    serviceName = svc.name;
                    serviceDuration = svc.duration + ' min';
                } else if (typeof serviceId === 'string' && serviceId.length > 0 && !serviceId.startsWith('svc-')) {
                    serviceName = serviceId;
                }
            }
        } catch (e) { console.warn('EmailService: Failed to resolve service name', e); }

        // Resolve Worker Name
        let workerName = 'Un coiffeur du salon';
        if (workerId && workerId != 1) {
            try {
                const worker = await db.getAdminById(workerId);
                if (worker) workerName = worker.display_name || worker.username;
            } catch (e) { console.warn('EmailService: Failed to resolve worker name', e); }
        }

        const transportConfig = {
            host: settings.host || 'smtp.gmail.com',
            port: settings.port || 465,
            secure: (settings.port || 465) == 465,
            auth: { user: settings.user, pass: settings.pass },
            tls: { rejectUnauthorized: false }, family: 4
        };
        const transporter = nodemailer.createTransport(transportConfig);

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const link = `${baseUrl}/api/waiting-list/access?token=${token}`;

        const mailOptions = {
            from: `"La Base Coiffure" <${settings.user}>`,
            to: to,
            subject: 'Une place s\'est libérée !',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #eeba30; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #eeba30; text-align: center;">Une opportunité pour vous !</h2>
                    <p>Bonjour ${name},</p>
                    <p>Suite à un désistement, un créneau est disponible :</p>
                    
                    <div style="background-color: #fff8e1; padding: 15px; text-align: center; font-size: 1.2em; margin: 20px 0;">
                        <strong>${date.split('-').reverse().join('/')}</strong> à <strong>${time}</strong>
                    </div>

                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Prestation :</strong> ${serviceName}</p>
                         <p style="margin: 5px 0;"><strong>Durée :</strong> ${serviceDuration}</p>
                        <p style="margin: 5px 0;"><strong>Coiffeur :</strong> ${workerName}</p>
                    </div>

                    <p style="text-align: center;"><strong>Ce créneau vous est réservé pendant 20 minutes !</strong><br>Passé ce délai, il sera proposé à la personne suivante.</p>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${link}" style="background-color: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 1.1em;">DONNER MA RÉPONSE</a>
                    </p>
                    
                    <p style="font-size: 12px; color: #777; text-align: center;">Si ce lien ne fonctionne pas : <br> ${link}</p>
                </div>
            `
        };

        if (process.env.NODE_ENV === 'test') {
            console.log(`[EmailService] TEST MODE: Email suppressed to ${to}`);
            return;
        }

        await transporter.sendMail(mailOptions);
    }
}

module.exports = new EmailService();
