const waitingListService = require('../services/waitingListService');
const emailService = require('../services/emailService');

exports.join = async (req, res) => {
    try {
        const { name, email, phone, target_date, desired_service_id, desired_worker_id } = req.body;

        if (!email) {
            return res.status(400).json({ error: "L'email est obligatoire pour la liste d'attente." });
        }

        await waitingListService.addRequest({
            name,
            email,
            phone,
            date: target_date,
            service: desired_service_id,
            workerId: desired_worker_id
        });

        // Confirmation email
        await emailService.sendWaitlistJoin(email, name, target_date, desired_service_id, desired_worker_id);

        res.json({ success: true });
    } catch (e) {
        console.error('Join Waitlist Error:', e);
        res.status(500).json({ error: "Erreur lors de l'inscription." });
    }
};

exports.access = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send("Lien invalide.");

        // Verify token existence (optional here, but good for fail-fast)
        const db = require('../models/database');
        const reqData = await db.getWaitingRequestByToken(token);

        if (!reqData || reqData.status !== 'OFFER_SENT') {
            return res.status(400).send("Ce lien a expiré ou est invalide.");
        }

        // Set HttpOnly Cookie
        res.cookie('wl_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 20 * 60 * 1000 // 20 mins match expiry
        });

        // Redirect to claim page (clean URL)
        res.redirect('/claim.html');
    } catch (e) {
        console.error("Access Error", e);
        res.status(400).send("Erreur serveur.");
    }
};

exports.claim = async (req, res) => {
    // Legacy support or direct link? 
    // Let's redirect to access to force cookie flow if token is present
    if (req.query.token) {
        return exports.access(req, res);
    }
    res.redirect('/claim.html');
};

exports.getDetails = async (req, res) => {
    // Priority: Query Token -> Cookie Token
    const token = req.query.token || req.cookies.wl_token;

    if (!token) return res.status(400).json({ error: "Token manquant." });

    const db = require('../models/database');
    const reqData = await db.getWaitingRequestByToken(token);

    if (!reqData || reqData.status !== 'OFFER_SENT') {
        return res.status(400).json({ error: 'C\'est trop tard, votre réservation n\'est plus valide.' });
    }

    let holdAppt;
    const findSql = (db.type === 'pg')
        ? "SELECT * FROM appointments WHERE email = $1 AND date = $2 AND status = 'HOLD'"
        : "SELECT * FROM appointments WHERE email = ? AND date = ? AND status = 'HOLD'";
    holdAppt = await db.getOne(findSql, [reqData.client_email, reqData.target_date]);

    if (!holdAppt) return res.status(400).json({ error: 'C\'est trop tard, votre réservation n\'est plus valide.' });

    res.json({
        client_name: reqData.client_name,
        service: reqData.desired_service_id,
        date: reqData.target_date,
        time: holdAppt.time,
        worker_id: holdAppt.admin_id
    });
};

exports.confirm = async (req, res) => {
    try {
        const token = req.body.token || req.cookies.wl_token;
        if (!token) throw new Error("Token manquant");

        await waitingListService.confirmRequest(token);
        res.clearCookie('wl_token'); // Clear cookie on success
        res.json({ success: true });
    } catch (e) {
        console.error('Confirm Error:', e);
        res.status(400).json({ error: e.message || "Erreur lors de la confirmation." });
    }
};

exports.refuse = async (req, res) => {
    try {
        const token = req.body.token || req.cookies.wl_token;
        if (!token) throw new Error("Token manquant");

        await waitingListService.refuseRequest(token);
        res.clearCookie('wl_token'); // Clear cookie
        res.json({ success: true });
    } catch (e) {
        console.error('Refuse Error:', e);
        res.status(400).json({ error: "Erreur lors du refus." });
    }
};

exports.counts = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "Date requise" });
        const counts = await waitingListService.getCountsForDate(date);
        res.json(counts);
    } catch (e) {
        console.error('Waitlist Counts Error:', e);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

exports.list = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "Date requise" });
        const requests = await waitingListService.getRequestsForDate(date);
        res.json(requests);
    } catch (e) {
        console.error('Waitlist List Error:', e);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

exports.scan = async (req, res) => {
    try {
        await waitingListService.scanWaitlist();
        res.json({ success: true, message: 'Scan complete' });
    } catch (e) {
        console.error('Manual Scan Error:', e);
        res.status(500).json({ error: "Erreur lors du scan." });
    }
};
