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
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${data.to}`);
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
            await transporter.sendMail(mailOptions);
            console.log(`Reset email sent to ${to}`);
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

                    <p>Nous vous invitons à reprendre rendez-vous sur notre site ou à nous contacter pour plus d'informations.</p>
                    <p>Veuillez nous excuser pour ce désagrément.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #777;">La Base Coiffure<br>Ref: ${Date.now().toString().slice(-6)}</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Cancellation email sent to ${appointment.email}`);
        } catch (error) {
            console.error('EmailService Cancellation Error:', error);
        }
    }
}

module.exports = new EmailService();
