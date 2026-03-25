const db = require('../models/database');

class AppointmentService {

    /**
     * Calculate available slots for a given date and admin
     */
    /**
     * Calculate available slots for a given date and admin
     */
    async getAvailableSlots(date, adminId, serviceId, excludeAppointmentId = null) {
        if (!date) throw new Error('Date required');

        // 0. Check Date Limit (2 Months)
        const checkDate = new Date(date);
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize today
        const limitDate = new Date(now);
        limitDate.setMonth(limitDate.getMonth() + 2);

        if (checkDate > limitDate) {
            return { slots: [], reason: 'date_limit_exceeded' };
        }

        // 1. Check Global Holidays (Exceptions)
        const holidays = (await db.getSetting('holidays')) || [];
        if (holidays.includes(date)) {
            return { slots: [], reason: 'holiday' };
        }

        // 2. Check Opening Hours (Regular Weekly Closure)
        let openingHours = await db.getSetting('opening_hours') || await db.getSetting('openingHours');
        const dayOfWeek = new Date(date).getDay();
        let daySettings = null;

        if (Array.isArray(openingHours)) {
            daySettings = openingHours[dayOfWeek];
        } else {
            openingHours = openingHours || { start: '09:00', end: '18:00', closedDays: [] };
            const isClosed = openingHours.closedDays && openingHours.closedDays.includes(dayOfWeek);
            daySettings = {
                isOpen: !isClosed,
                open: openingHours.start,
                close: openingHours.end
            };
        }

        if (!daySettings || !daySettings.isOpen) {
            return { slots: [], reason: 'closed' };
        }

        // 3. Check Leaves (Global vs Personal)
        const leaves = await db.getLeaves(adminId);
        const globalLeave = leaves.find(l => l.admin_id === null && date >= l.start_date && date <= l.end_date);
        if (globalLeave) {
            return { slots: [], reason: 'salon_closed' };
        }

        // 4. Check Worker Presence
        if (adminId) {
            const admin = await db.getAdminById(adminId);
            if (admin && admin.days_off) {
                const daysOff = typeof admin.days_off === 'string' ? JSON.parse(admin.days_off) : admin.days_off;
                if (Array.isArray(daysOff) && daysOff.includes(dayOfWeek)) {
                    return { slots: [], reason: 'worker_off_day' };
                }
            }
        }

        const personalLeave = leaves.find(l => l.admin_id !== null && date >= l.start_date && date <= l.end_date);
        if (personalLeave) {
            return { slots: [], reason: 'leave' };
        }

        // --- SMART SCHEDULING LOGIC ---
        const services = (await db.getSetting('services')) || [];

        // A. Get Service Duration
        let serviceDuration = 30; // Default
        if (serviceId) {
            let service = services.find(s => s.id == serviceId);
            if (!service) {
                service = services.find(s => s.name === serviceId);
            }
            if (service && service.duration) {
                serviceDuration = parseInt(service.duration);
            }
        }

        // B. Get Day Boundaries (Minutes)
        const [startHour, startMinute] = daySettings.open.split(':').map(Number);
        const [endHour, endMinute] = daySettings.close.split(':').map(Number);
        if (isNaN(startHour) || isNaN(endHour)) return { slots: [], reason: 'closed' };

        const dayStart = startHour * 60 + startMinute;
        const dayEnd = endHour * 60 + endMinute;

        // C. Get Existing Bookings
        let booked = await db.getBookingsForDate(date, adminId);
        if (excludeAppointmentId) {
            booked = booked.filter(b => b.id != excludeAppointmentId);
        }

        const occupiedIntervals = [];
        for (const b of booked) {
            const [bh, bm] = b.time.split(':').map(Number);
            const bStart = bh * 60 + bm;

            let bDuration = 30;
            const knownService = services.find(s => s.name === b.service || s.id == b.service);
            if (knownService && knownService.duration) {
                bDuration = parseInt(knownService.duration);
            }
            occupiedIntervals.push({ start: bStart, end: bStart + bDuration });
        }

        if (daySettings.breakStart && daySettings.breakEnd) {
            const [bStartH, bStartM] = daySettings.breakStart.split(':').map(Number);
            const [bEndH, bEndM] = daySettings.breakEnd.split(':').map(Number);
            if (!isNaN(bStartH) && !isNaN(bEndH)) {
                occupiedIntervals.push({ start: bStartH * 60 + bStartM, end: bEndH * 60 + bEndM });
            }
        }

        occupiedIntervals.sort((a, b) => a.start - b.start);

        // D. Generate Slots using Anchor-Based Dynamic Grid
        const anchors = new Set([dayStart]);
        occupiedIntervals.forEach(interval => {
            if (interval.end >= dayStart && interval.end < dayEnd) anchors.add(interval.end);
        });

        const sortedAnchors = Array.from(anchors).sort((a, b) => a - b);
        const candidateStartTimes = new Set();

        for (const anchor of sortedAnchors) {
            let t = anchor;
            while (t <= dayEnd - serviceDuration) {
                const proposedStart = t;
                const proposedEnd = t + serviceDuration;
                let isClashing = false;

                for (const interval of occupiedIntervals) {
                    if (proposedStart < interval.end && proposedEnd > interval.start) {
                        isClashing = true;
                        break;
                    }
                }

                if (!isClashing) {
                    candidateStartTimes.add(t);
                    t += serviceDuration;
                } else {
                    break;
                }
            }
        }

        const sortedCandidates = Array.from(candidateStartTimes).sort((a, b) => a - b);
        const timeSlots = [];
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();

        for (const t of sortedCandidates) {
            if (date === todayStr && t <= currentMinutes) continue;
            const h = Math.floor(t / 60);
            const m = t % 60;
            timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }

        return { slots: timeSlots, reason: timeSlots.length === 0 ? 'full' : null };
    }
    async createBooking(data) {
        const { name, date, time, service, phone, adminId, email } = data;

        // 0. Check Date Limit (2 Months) Security
        const checkDate = new Date(date);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const limitDate = new Date(now);
        limitDate.setMonth(limitDate.getMonth() + 2);

        if (checkDate > limitDate) {
            throw new Error('La réservation est impossible plus de 2 mois à l\'avance.');
        }

        // Double check availability (Race condition protection)
        // Reuse getAvailableSlots checking logic or just simpler overlap check

        // Need service duration
        let serviceDuration = 30;
        const services = (await db.getSetting('services')) || [];
        const knownService = services.find(s => s.name === service); // Matching by name as stored in DB
        if (knownService && knownService.duration) {
            serviceDuration = parseInt(knownService.duration);
        }

        const [bh, bm] = time.split(':').map(Number);
        const newStart = bh * 60 + bm;
        const newEnd = newStart + serviceDuration;

        // 1. Check constraints against Opening Hours & Breaks
        const openingHours = await db.getSetting('opening_hours');
        let dayConfig;
        if (typeof openingHours === 'object') { // Already parsed usually?
            // db.getSetting returns parsed JSON if handled? No, usually string?
            // Let's safe parse. 
            // Actually getSetting relies on generic DB, usually string.
            // But previous code (getAvailableSlots) calls `db.getSetting('openingHours')` (CamelCase?).
            // DB key is likely `opening_hours`.
        }

        let allHours;
        try {
            const raw = await db.getSetting('opening_hours');
            allHours = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        } catch (e) { }

        if (allHours) {
            const dayOfWeek = new Date(date).getDay();
            const dc = allHours[dayOfWeek] || allHours[String(dayOfWeek)];

            if (!dc || !dc.isOpen) {
                throw new Error('Le salon est fermé ce jour-là.');
            }

            // Normalize Keys (Fix for DB open/close vs start/end)
            const openTime = dc.open || dc.start;
            const closeTime = dc.close || dc.end;
            const breakTimeStart = dc.breakStart || dc.pause_start;
            const breakTimeEnd = dc.breakEnd || dc.pause_end;

            if (openTime && closeTime) {
                const [oh, om] = openTime.split(':').map(Number);
                const [ch, cm] = closeTime.split(':').map(Number);
                const dayStartMin = oh * 60 + om;
                const dayEndMin = ch * 60 + cm;

                if (newStart < dayStartMin || newEnd > dayEndMin) {
                    throw new Error('Le rendez-vous est en dehors des horaires d\'ouverture.');
                }
            }

            if (breakTimeStart && breakTimeEnd) {
                const [bsh, bsm] = breakTimeStart.split(':').map(Number);
                const [beh, bem] = breakTimeEnd.split(':').map(Number);
                const bStartMin = bsh * 60 + bsm;
                const bEndMin = beh * 60 + bem;

                // Overlap Check with Break
                // Gap [bStart, bEnd]
                // New [newStart, newEnd]
                if (newStart < bEndMin && newEnd > bStartMin) {
                    throw new Error('Le rendez-vous tombe pendant la pause.');
                }
            }
        }

        // Check against existing bookings
        const booked = await db.getBookingsForDate(date, adminId);
        for (const b of booked) {
            const [ebh, ebm] = b.time.split(':').map(Number);
            const bStart = ebh * 60 + ebm;

            let bDuration = 30;
            const existingService = services.find(s => s.name === b.service);
            if (existingService && existingService.duration) {
                bDuration = parseInt(existingService.duration);
            }
            const bEnd = bStart + bDuration;

            // Overlap check
            if (newStart < bEnd && newEnd > bStart) {
                throw new Error('Slot already booked or overlaps');
            }
        }

        const result = await db.createBooking(name, date, time, service, phone, adminId, email);

        // --- LOYALTY PROGRAM TICK ---
        if (email) {
            const lowEmail = email.trim().toLowerCase();
            try {
                if (data.optInLoyalty === true || data.optInLoyalty === 'true') {
                    console.log(`[Loyalty] Opting in for ${lowEmail}`);
                    await db.upsertClientLoyalty(lowEmail, name, phone, true);
                }
                let loyaltyResult = null;
                const client = await db.getClientByEmail(lowEmail);
                console.log(`[Loyalty] Client state:`, client ? { opt: client.opt_in_loyalty, pts: client.loyalty_points } : 'not found');
                // SQLite returns 1 for true, PG returns true
                if (client && (client.opt_in_loyalty === 1 || client.opt_in_loyalty === true)) {
                    console.log(`[Loyalty] Adding point for ${lowEmail}`);
                    loyaltyResult = await db.addClientPoint(lowEmail);
                } else {
                    console.log(`[Loyalty] No point added (opt_in was ${client?.opt_in_loyalty})`);
                }
                
                // Add loyalty result to response
                result.loyaltyTransition = loyaltyResult;
            } catch (err) {
                console.error('[Loyalty] Error attributing point:', err);
            }
        }

        return result;
    }

    /**
     * Cancel an appointment (Centralized Logic)
     * @param {number|string} id - Appointment ID
     * @param {Object} options - { reason, source: 'admin'|'client', sendEmail: boolean }
     */
    async cancelAppointment(id, options = {}) {
        const { reason, source, sendEmail } = options;
        const waitingListService = require('./waitingListService');
        const emailService = require('./emailService');
        const socketService = require('./socketService'); // IMPORT SOCKET SERVICE
        const { triggerUpdate } = require('../config/polling');

        // 1. Fetch Appointment Details BEFORE deletion
        const appointment = await db.getAppointmentById(id);
        if (!appointment) {
            // Idempotent success or throw? 
            // If it's already gone, our job is done, but maybe warn.
            return { success: false, message: 'Appointment not found' };
        }

        // 2. Calculate Duration (Critical for Waitlist)
        let duration = 30;
        const services = await db.getSetting('services') || [];
        // appointment.service is a Name string.
        const s = services.find(srv => srv.name === appointment.service);
        if (s && s.duration) duration = parseInt(s.duration);

        // 3. Send Cancellation Email (if requested or source is client?)
        // If client cancels, they know. But maybe send "Confirmation of cancellation"?
        // If Admin cancels, usually send email.
        if (sendEmail && appointment.email) {
            // Resolve Worker Name
            let workerName = 'Le Coiffeur';
            if (appointment.admin_id) {
                const admin = await db.getAdminById(appointment.admin_id);
                if (admin) workerName = admin.display_name || admin.username;
            }

            try {
                await emailService.sendCancellation(appointment, {
                    reason: reason || 'Annulation',
                    workerName
                });
            } catch (e) {
                console.error('[AppointmentService] Failed to send cancellation email:', e);
            }
        }

        // 4. Delete Record
        await db.deleteAppointment(id);

        // --- LOYALTY PENALTY ---
        if (appointment.email) {
            const lowEmail = appointment.email.toLowerCase();
            try {
                const client = await db.getClientByEmail(lowEmail);
                if (client && (client.opt_in_loyalty === 1 || client.opt_in_loyalty === true)) {
                    await db.removeClientPoint(lowEmail);
                }
            } catch (err) {
                console.error('[Loyalty] Error removing point:', err);
            }
        }

        // 5. Trigger Processes
        // A. Waitlist
        // We pass the FREED slot details to the waitlist processor
        try {
            await waitingListService.processCancellation(appointment.date, appointment.time, duration, appointment.admin_id);
        } catch (e) {
            console.error('[AppointmentService] Waitlist processing failed:', e);
        }

        // B. Real-time Update
        triggerUpdate(); // Keep for compatibility if any old polling remains
        try {
            socketService.getIO().emit('appointmentsUpdated'); // EMIT SOCKET EVENT
        } catch (e) { console.error('Socket emit error:', e); }

        return { success: true, appointment };
    }

    /**
     * Update an appointment time with overlap checks
     */
    async updateAppointment(id, newTime) {
        if (!id || !newTime) throw new Error('ID et heure requis');

        // 1. Fetch current appointment
        const appointment = await db.getAppointmentById(id);
        if (!appointment) throw new Error('Rendez-vous introuvable');

        // 2. Calculate duration
        let duration = 30;
        const services = await db.getSetting('services') || [];
        const s = services.find(srv => srv.name === appointment.service);
        if (s && s.duration) duration = parseInt(s.duration);

        const [nh, nm] = newTime.split(':').map(Number);
        const newStart = nh * 60 + nm;
        const newEnd = newStart + duration;

        // 3. Check against opening hours & breaks
        const openingHours = await db.getSetting('opening_hours');
        let allHours;
        try {
            allHours = (typeof openingHours === 'string') ? JSON.parse(openingHours) : openingHours;
        } catch (e) { }

        if (allHours) {
            const dayOfWeek = new Date(appointment.date).getDay();
            const dc = allHours[dayOfWeek] || allHours[String(dayOfWeek)];

            if (dc && dc.isOpen) {
                const openTime = dc.open || dc.start;
                const closeTime = dc.close || dc.end;
                const breakTimeStart = dc.breakStart || dc.pause_start;
                const breakTimeEnd = dc.breakEnd || dc.pause_end;

                if (openTime && closeTime) {
                    const [oh, om] = openTime.split(':').map(Number);
                    const [ch, cm] = closeTime.split(':').map(Number);
                    const dayStartMin = oh * 60 + om;
                    const dayEndMin = ch * 60 + cm;
                    if (newStart < dayStartMin || newEnd > dayEndMin) {
                        throw new Error('Le rendez-vous est en dehors des horaires d\'ouverture.');
                    }
                }

                if (breakTimeStart && breakTimeEnd) {
                    const [bsh, bsm] = breakTimeStart.split(':').map(Number);
                    const [beh, bem] = breakTimeEnd.split(':').map(Number);
                    const bStartMin = bsh * 60 + bsm;
                    const bEndMin = beh * 60 + bem;
                    if (newStart < bEndMin && newEnd > bStartMin) {
                        throw new Error('Le rendez-vous tombe pendant la pause.');
                    }
                }
            }
        }

        // 4. Check against other bookings
        const allApts = await db.getAppointmentsForWorker(appointment.date, appointment.admin_id);
        for (const a of allApts) {
            if (a.id == id) continue; // Skip self

            const [ebh, ebm] = a.time.split(':').map(Number);
            const bStart = ebh * 60 + ebm;

            let bDuration = 30;
            const existingService = services.find(srv => srv.name === a.service);
            if (existingService && existingService.duration) {
                bDuration = parseInt(existingService.duration);
            }
            const bEnd = bStart + bDuration;

            if (newStart < bEnd && newEnd > bStart) {
                throw new Error('Slot already booked or overlaps');
            }
        }

        // 5. Perform Update
        await db.updateAppointment(id, newTime);
        return { success: true };
    }
}

module.exports = new AppointmentService();
