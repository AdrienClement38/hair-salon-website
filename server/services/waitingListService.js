const db = require('../models/database');
const emailService = require('./emailService');
const crypto = require('crypto');

// Helper for duration
const getServiceDuration = (serviceName, allServices) => {
    const s = allServices.find(s => s.name === serviceName);
    return s ? s.duration : 30; // default safety
};

const getServicesFittingInDuration = (durationAvailable, allServices) => {
    // Current Booking uses service NAME.
    // We interpret "desired_service_id" as "desired_service_name" for consistency.
    return allServices.filter(s => s.duration <= durationAvailable).map(s => s.name);
};

class WaitingListService {

    async addRequest(data) {
        // { name, email, phone, date, service, workerId }
        // Service is Name here.
        return await db.addWaitingListRequest(data.name, data.email, data.phone, data.date, data.service, data.workerId);
    }

    // Triggered when an appointment is deleted
    async scanWaitlist() {
        console.log('[WaitList] Starting periodic scan...');
        try {
            const dates = await db.getPendingWaitingDates();
            const services = await db.getSetting('services') || [];

            // For each date, check all workers?
            // Optimization: If a waiter wants "Adrien", we only care about Adrien.
            // But simpler: Check all workers for gaps on that date.
            const admins = await db.getAllAdmins();

            for (const date of dates) {
                for (const admin of admins) {
                    const gaps = await db.getDailyGaps(date, admin.id);
                    for (const gap of gaps) {
                        if (gap.duration >= 15) { // Minimum practical slot
                            // Check compatibility
                            const compatible = getServicesFittingInDuration(gap.duration, services);
                            if (compatible.length > 0) {
                                // Try match
                                // Note: matchAndOffer will check if request is for this worker
                                await this.matchAndOffer(date, gap.start, admin.id, compatible, services);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[WaitList] Scan failed:', e);
        }
    }

    async processCancellation(date, time, freedDuration, workerId) {
        console.log(`[WaitList] Processing cancellation: ${date} ${time} (${freedDuration}min) for worker ${workerId}`);

        // 1. Get all services to know durations
        const services = await db.getSetting('services') || [];

        // --- GAP DETECTION LOGIC ---
        // Fetch valid opening hours for this day
        let dayStart = 9 * 60 + 30; // Default 09:30
        let dayEnd = 19 * 60;       // Default 19:00

        try {
            let openingHours = await db.getSetting('opening_hours');
            if (typeof openingHours === 'string') openingHours = JSON.parse(openingHours);

            const dayOfWeek = new Date(date).getDay(); // 0=Sun, 1=Mon
            // Front-end often maps 0->Mon? Let's check typical structure.
            // Usually DB stores strict JS index.
            // If openingHours uses "1" for Monday...
            // Let's assume standard JS index for now or string keys.
            // Safety: check if key exists.
            const dayConfig = openingHours[dayOfWeek] || openingHours[String(dayOfWeek)];
            if (dayConfig && dayConfig.start && dayConfig.end) {
                const [sh, sm] = dayConfig.start.split(':').map(Number);
                const [eh, em] = dayConfig.end.split(':').map(Number);
                dayStart = sh * 60 + sm;
                dayEnd = eh * 60 + em;
            }
        } catch (e) {
            console.warn('[WaitList] Could not fetch opening hours, using defaults.', e);
        }

        // Fetch all appointments for this worker to find real gap
        const appts = await db.getAppointmentsForWorker(date, workerId);

        const timeToMins = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        const minsToTime = (m) => {
            const h = Math.floor(m / 60);
            const min = m % 60;
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        };

        const deletedStart = timeToMins(time);
        const deletedEnd = deletedStart + freedDuration;

        let bestStart = dayStart;
        let bestEnd = dayEnd;

        // Iterate appointments to shrink the window closest to the deleted slot
        // Bounds: [bestStart, ............. deletedStart ... deletedEnd ............. bestEnd]
        // We want the contiguous empty space containing [deletedStart, deletedEnd].

        for (const appt of appts) {
            const sDuration = getServiceDuration(appt.service, services);
            const aStart = timeToMins(appt.time);
            const aEnd = aStart + sDuration;

            // If appt is BEFORE the deleted slot (or touches start)
            if (aEnd <= deletedStart) {
                if (aEnd > bestStart) bestStart = aEnd;
            }

            // If appt is AFTER the deleted slot (or touches end)
            if (aStart >= deletedEnd) {
                if (aStart < bestEnd) bestEnd = aStart;
            }

            // Note: Overlapping appointments shouldn't happen logic-wise if we just deleted one,
            // but if they exist, they would constrain the gap naturally by falling into above categories or staying inside.
        }

        const newDuration = bestEnd - bestStart;
        const newStartTime = minsToTime(bestStart);

        // console.log(`[WaitList] Merged Gap Detected: ${newStartTime} (${newDuration}min) [Window: ${minsToTime(bestStart)} - ${minsToTime(bestEnd)}]`);

        // 2. Identify services that fit in this NEW merged slot
        const compatibleServiceNames = getServicesFittingInDuration(newDuration, services);

        if (compatibleServiceNames.length === 0) {
            console.log('[WaitList] No services fit in this slot.');
            return;
        }

        // 3. Find Candidate using the MERGED gap
        await this.matchAndOffer(date, newStartTime, workerId, compatibleServiceNames, services);
    }

    // Recursive-like function to find next match
    async matchAndOffer(date, time, workerId, compatibleServiceNames, allServices) {

        // Find oldest request provided it matches worker requirement and service duration
        const request = await db.findNextWaitingRequest(date, compatibleServiceNames, workerId);

        if (!request) {
            console.log('[WaitList] No matching requests found.');
            return;
        }

        console.log(`[WaitList] Match found: ${request.client_name} (ReqID: ${request.id})`);

        // Generate Token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 mins

        // We DO NOT create a HOLD appointment anymore.
        // The slot remains free.

        try {
            // Update Request Status
            await db.updateWaitingRequestStatus(request.id, 'OFFER_SENT', token, expiresAt.toISOString());

            // Send Email
            await emailService.sendSlotOffer(request.client_email, request.client_name, date, time, token);

        } catch (e) {
            console.error('[WaitList] Error updating status or sending email:', e);
        }
    }

    async confirmRequest(token) {
        const req = await db.getWaitingRequestByToken(token);
        if (!req) throw new Error("Jeton invalide");
        if (req.status !== 'OFFER_SENT') throw new Error("L'offre n'est plus valide");
        if (new Date(req.offer_expires_at) < new Date()) throw new Error("L'offre a expiré");

        // 1. Check if the slot is STILL available
        // We need to check if there is an appointment at this time for this worker?
        // Actually, db.createBooking will fail if slot is taken (constraint or check).
        // But we want a nice error message.

        // Note: createBooking logic in appointmentService checks for conflicts.
        // We can just try to create the booking directly using DB helper.

        const serviceName = req.desired_service_id;

        // We need to handle the workerId. If request had one, use it.
        // If not, we need to know WHICH worker was available?
        // The request table calls it `desired_worker_id` but that might be null if "Any".
        // HOWEVER, when we made the offer, it was triggered by a specific worker's cancellation (usually).
        // But `matchAndOffer` didn't save "offered worker" in the request table?
        // Wait, `db.findNextWaitingRequest` filters by workerId if provided.
        // If the user said "Any", and we offered a slot with Worker A, we need to book Worker A.
        // The `waiting_list_requests` table doesn't seem to store "offered_worker_id".
        // This is a small design flaw in the original code too?
        // Original code: created HOLD appointment with `workerId`. So we knew.

        // Fix: We need to find WHO is free at `req.target_date` matching the service duration?
        // Or simply: The `processCancellation` triggered it.
        // If we don't store the offered worker, we might book for "Any" worker who is free?
        // Let's see if we can deduce it.
        // Or simply assign to any available worker?

        // Ideally we should have updated the request with "offered_worker_id"?
        // But let's look at `createBooking`. It takes `workerId`.

        // Problem: If `req.desired_worker_id` is ALL, we don't know who offered the slot.
        // BUT, if the slot is free, does it matter?
        // Yes, because different workers have different schedules.
        // We should probably check availability for the requested service.

        // Let's deduce the worker:
        // If `req.desired_worker_id` is set, use it.
        // If not, use `appointmentService.getAvailableSlots` logic? No too heavy.

        // Let's restart: we want to book.
        // Use `appointmentService.createBooking`?
        // It does validation.

        let targetWorkerId = req.desired_worker_id;

        if (!targetWorkerId) {
            // Find a worker who is free at this time.
            const services = await db.getSetting('services') || [];
            const duration = getServiceDuration(serviceName, services);
            // This requires a helper "findAvailableWorker(date, time, duration)".
            // For now, let's assume we can pick one.
            // Or.. if we can't determine, maybe we fail?

            // To match original behavior (which passed workerId from cancellation to HOLD),
            // we have lost that context without the HOLD appt.
            // However, `processCancellation` passed `workerId`.
            // Currently `matchAndOffer` uses it to find request.
            // We should store it in `waiting_list_requests`?
            // The schema might not support it.

            // ALTERNATIVE: checking availability returns a list of workers?
            // Let's try to book with `null` if the system supports auto-assign?
            // `db.createBooking` expects `admin_id`.

            // Quick fix fallback: Check all admins.
            // Or simpler: The user click confirms. We try to find a spot.

            // Let's use `appointmentService.getAvailableSlots` logic in reverse?
            // Or just query the DB for "Who is free?".

            // For this iteration, I will assume `desired_worker_id` is sufficient OR
            // if null, I will pick the first available admin for that slot.

            const admins = await db.getAllAdmins();
            let foundWorker = null;

            // Check each admin
            for (const admin of admins) {
                const isFree = await db.checkAvailability(req.target_date, req.target_time, duration, admin.id); // hypothetical helper?
                // Actually `checkAvailability` isn't in DB adapter usually.

                // Let's use a try/catch approach with appointmentService?
                // But appointmentService.createBooking expects existing valid slot.

                // Let's try to query db directly to see if this admin has a conflict.
                const conflicts = await db.run(
                    "SELECT * FROM appointments WHERE date = ? AND admin_id = ? AND NOT (time >= ? OR ? >= end_time)",
                    [req.target_date, admin.id, endTime, startTime] // psuedo code... time logic is hard.
                );
                // This is getting complicated to inject here.

                // RE-EVALUATION: The simplest way is to create a HOLD appointment ONLY IF we have the info?
                // No, user said NO HOLD.

                // Maybe we can update query to store `offered_worker_id` in `waiting_list_requests`?
                // I don't want to change DB schema in the middle of this.

                // Let's look at `waiting_list_requests` table schema? not visible here.
                // Assuming it doesn't have it.

                // Let's trust that if `desired_worker_id` is null, ANYONE is fine.
                // We pick the first one that doesn't trigger a collision.
                // We will simply loop through admins and try to `db.createBooking`.
                // If it succeeds, break.

                // If `req.desired_worker_id` IS set, we try that one.
            }
        }

        // Actually, `email` service usually takes `workerName`.
        // Let's try to use `appointmentService.createBooking` which we imported?
        // No, `waitingListService` imports `db`.
        // Let's import `appointmentService` if not already (it wasn't).

        // But wait, `db.createBooking` is raw.
        // Let's look at `db.createBooking` signature in `matchAndOffer` (lines 66-75 original).
        // It passed `workerId || request.desired_worker_id`.

        // So we DO have a problem if `desired_worker_id` is NULL and we don't know who cancelled.
        // BUT, if the slot is showing up as free, the user sees it on the calendar for a specific worker usually?
        // Or if they select "Any", the system shows generic slots.

        // Let's assume for now we use `desired_worker_id`. If null, we might have an issue.
        // But in `matchAndOffer` (the trigger), we KNEW the workerId.
        // If we don't persist it, we lose it.

        // CRITICAL DEVIATION: I will persist the `workerId` in the `waiting_list_requests` table by using `desired_worker_id` field?
        // No, if user wanted "Any", we shouldn't force them to "Bob" forever if "Alice" opens up later?
        // Actually, if we send an offer for this specific slot (Date/Time/Worker), implies we are matched to it.
        // Is it acceptable to temporarily update `desired_worker_id` to the matched worker?
        // If they decline/refuse, we might want to revert? No, if refused, request is dead.
        // If expired, request is dead.
        // So YES, we can update `desired_worker_id` to the matching workerId when we send the offer!

        // Wait, `processCancellation` -> `matchAndOffer` -> `db.updateWaitingRequestStatus`.
        // We can ALSO update `desired_worker_id` there.

        // Let's do that in `matchAndOffer`.
    }

    // Recursive-like function to find next match
    async matchAndOffer(date, time, workerId, compatibleServiceNames, allServices) {

        // Find oldest request provided it matches worker requirement and service duration
        const request = await db.findNextWaitingRequest(date, compatibleServiceNames, workerId);

        if (!request) {
            console.log('[WaitList] No matching requests found.');
            return;
        }

        console.log(`[WaitList] Match found: ${request.client_name} (ReqID: ${request.id})`);
        // Use simpler token because we rely on the HOLD appt for data now
        // But keeping it unique is fine.
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 mins

        try {
            // 1. Create HOLD appointment (Reserved Slot)
            await db.createBooking(
                request.client_name,
                date,
                time,
                request.desired_service_id,
                request.client_phone,
                workerId,
                request.client_email,
                'HOLD'
            );

            // 2. Update Request Status
            await db.updateWaitingRequestStatus(request.id, 'OFFER_SENT', token, expiresAt.toISOString());

            // 3. Send Email
            await emailService.sendSlotOffer(request.client_email, request.client_name, date, time, token);

        } catch (e) {
            console.error('[WaitList] Error creating HOLD or sending email:', e);
        }
    }

    async confirmRequest(token) {
        const req = await db.getWaitingRequestByToken(token);
        if (!req) throw new Error("Jeton invalide");
        if (req.status !== 'OFFER_SENT') throw new Error("L'offre n'est plus valide");
        if (new Date(req.offer_expires_at) < new Date()) throw new Error("L'offre a expiré");

        // Find the HOLD appointment
        const appts = await db.run("SELECT * FROM appointments WHERE email = ? AND date = ? AND status = 'HOLD'", [req.client_email, req.target_date]);
        const holdAppt = appts[0];

        if (!holdAppt) {
            throw new Error("La réservation temporaire n'existe plus (peut-être expirée ?).");
        }

        // Update Appointment to CONFIRMED
        await db.run("UPDATE appointments SET status = 'CONFIRMED' WHERE id = ?", [holdAppt.id]);

        // Update Request to BOOKED
        await db.updateWaitingRequestStatus(req.id, 'BOOKED');
    }

    async refuseRequest(token) {
        const req = await db.getWaitingRequestByToken(token);
        if (!req || req.status !== 'OFFER_SENT') return;

        // Update Request to REFUSED
        await db.updateWaitingRequestStatus(req.id, 'REFUSED');

        // Find and Delete HOLD appointment
        const appts = await db.run("SELECT * FROM appointments WHERE email = ? AND date = ? AND status = 'HOLD'", [req.client_email, req.target_date]);
        const holdAppt = appts[0];

        if (holdAppt) {
            await db.deleteAppointment(holdAppt.id);

            // Trigger next match
            // We need duration. from `holdAppt`? No, we need service duration.
            const services = await db.getSetting('services') || [];
            // We can get duration from the service name in holdAppt.service
            const duration = getServiceDuration(holdAppt.service, services);
            const compatibleServiceNames = getServicesFittingInDuration(duration, services);

            // Re-trigger with original details
            await this.matchAndOffer(holdAppt.date, holdAppt.time, holdAppt.admin_id, compatibleServiceNames, services);
        }
    }

    async getCountsForDate(date) {
        return await db.getWaitingListCounts(date);
    }

    async getRequestsForDate(date) {
        return await db.getWaitingRequestsForDate(date);
    }

    async handleTimeouts() {
        const expired = await db.getExpiredOffers();
        for (const req of expired) {
            console.log(`[WaitList] Offer expired for request ${req.id}`);
            await db.updateWaitingRequestStatus(req.id, 'EXPIRED');

            // Find/Delete HOLD
            const appts = await db.run("SELECT * FROM appointments WHERE email = ? AND date = ? AND status = 'HOLD'", [req.client_email, req.target_date]);
            const holdAppt = appts[0];

            if (holdAppt) {
                await db.deleteAppointment(holdAppt.id);

                // Trigger next
                const services = await db.getSetting('services') || [];
                const duration = getServiceDuration(holdAppt.service, services);
                const compatibleServiceNames = getServicesFittingInDuration(duration, services);

                await this.matchAndOffer(holdAppt.date, holdAppt.time, holdAppt.admin_id, compatibleServiceNames, services);
            }
        }
    }
}

module.exports = new WaitingListService();
