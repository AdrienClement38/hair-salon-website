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
        await emailService.sendWaitlistJoin(email, name, target_date, desired_service_id);

        res.json({ success: true });
    } catch (e) {
        console.error('Join Waitlist Error:', e);
        res.status(500).json({ error: "Erreur lors de l'inscription." });
    }
};

exports.claim = async (req, res) => {
    try {
        const { token } = req.query;
        // Verify token existence
        // We could render a nice HTML page here directly or redirect to a static HTML that fetches details.
        // For simplicity and security, let's render text/html directly or redirect to a simple claim page
        // that will POST to confirm.

        // Actually, the easiest is to serve a static HTML file that reads the token from URL
        // and calls an API to get details.
        // But for "One Click" experience, we want to show details immediately.
        // Let's redirect to /claim.html?token=... and let that page fetch details via a verify endpoint?
        // Or cleaner: This endpoint returns HTML.

        // Let's return a simple HTML string for now or redirect to frontend route.
        // The user asked for a "validation" page.

        res.redirect(`/claim.html?token=${token}`);
    } catch (e) {
        res.status(400).send("Lien invalide ou expiré.");
    }
};

exports.getDetails = async (req, res) => {
    // Endpoint for claim.html to fetch details about the offer using token
    // NOT IMPLEMENTED yet in Service to "get details without confirming".
    // We need `getWaitingRequestByToken`.
    const db = require('../models/database');
    const reqData = await db.getWaitingRequestByToken(req.query.token);

    if (!reqData || reqData.status !== 'OFFER_SENT') {
        return res.status(400).json({ error: 'C\'est trop tard, votre réservation n\'est plus valide.' });
    }

    // We also want to know the "Hold" appointment time to display it.
    // It's linked to this request.
    // We have target_date, but not time in request table.
    // We need to find the hold appt.
    let holdAppt;
    const findSql = (db.type === 'pg')
        ? "SELECT * FROM appointments WHERE email = $1 AND date = $2 AND status = 'HOLD'"
        : "SELECT * FROM appointments WHERE email = ? AND date = ? AND status = 'HOLD'";
    holdAppt = await db.getOne(findSql, [reqData.client_email, reqData.target_date]);

    if (!holdAppt) return res.status(400).json({ error: 'C\'est trop tard, votre réservation n\'est plus valide.' });

    res.json({
        client_name: reqData.client_name,
        service: reqData.desired_service_id, // Name
        date: reqData.target_date,
        time: holdAppt.time,
        worker_id: holdAppt.admin_id
    });
};

exports.confirm = async (req, res) => {
    try {
        const { token } = req.body;
        await waitingListService.confirmRequest(token);
        res.json({ success: true });
    } catch (e) {
        console.error('Confirm Error:', e);
        res.status(400).json({ error: e.message || "Erreur lors de la confirmation." });
    }
};

exports.refuse = async (req, res) => {
    try {
        const { token } = req.body;
        await waitingListService.refuseRequest(token);
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
