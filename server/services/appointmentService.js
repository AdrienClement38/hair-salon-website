const db = require('../models/database');

class AppointmentService {

    /**
     * Calculate available slots for a given date and admin
     */
    /**
     * Calculate available slots for a given date and admin
     */
    async getAvailableSlots(date, adminId, serviceId) {
        if (!date) throw new Error('Date required');

        // 0. Check Date Limit (2 Months)
        const checkDate = new Date(date);
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize today
        const limitDate = new Date(now);
        limitDate.setMonth(limitDate.getMonth() + 2);

        if (checkDate > limitDate) {
            // Return empty slots silently or throw? Frontend expects slots array.
            // If date is too far, it's effectively "closed" or "invalid".
            // Let's return empty with a reason if possible, or just empty.
            return { slots: [], reason: 'date_limit_exceeded' };
        }

        // 1. Check Global Holidays (Exceptions)
        const holidays = (await db.getSetting('holidays')) || [];
        if (holidays.includes(date)) {
            return { slots: [], reason: 'holiday' };
        }

        // 2. Check Opening Hours (Regular Weekly Closure)
        // MOVED UP to prioritize "Salon Closed" message over Worker Absence
        let openingHours = await db.getSetting('opening_hours') || await db.getSetting('openingHours');
        const dayOfWeek = new Date(date).getDay();
        let daySettings = null;

        if (Array.isArray(openingHours)) {
            daySettings = openingHours[dayOfWeek];
        } else {
            // Legacy format fallback
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

        // 3a. Global Leave (Salon Closed Priority)
        const globalLeave = leaves.find(l => l.admin_id === null && date >= l.start_date && date <= l.end_date);
        if (globalLeave) {
            return { slots: [], reason: 'closed' }; // Treat Global Leave as "Closed"
        }

        // 4. Check Worker Weekly Days Off
        let admin = null;
        if (adminId) {
            admin = await db.getAdminById(adminId);
            if (admin && admin.days_off) {
                const daysOff = JSON.parse(admin.days_off); // Stored as JSON string in DB
                const dateDay = new Date(date).getDay(); // 0 = Sunday

                if (Array.isArray(daysOff) && daysOff.includes(dateDay)) {
                    // Worker is OFF this day of week
                    return { slots: [], reason: 'worker_off_day' };
                }
            }
        }

        // 5. Check Personal Leave
        const personalLeave = leaves.find(l => l.admin_id !== null && date >= l.start_date && date <= l.end_date);
        if (personalLeave) {
            return { slots: [], reason: 'leave' };
        }

        // --- SMART SCHEDULING LOGIC ---

        // A. Get Service Duration
        let serviceDuration = 30; // Default
        if (serviceId) {
            const services = (await db.getSetting('services')) || [];
            // Handle string vs number IDs loosely just in case
            const service = services.find(s => s.id == serviceId);
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
        const booked = await db.getBookingsForDate(date, adminId);

        // Convert bookings to occupied intervals [start, end] in minutes
        const occupiedIntervals = [];

        // Add bookings
        for (const b of booked) {
            const [bh, bm] = b.time.split(':').map(Number);
            const bStart = bh * 60 + bm;

            // We need the booking DURATION to know when it ends.
            // Issue: The database schema 'appointments' table DOES NOT store duration.
            // We only have 'service' name. This is a potential flaw in the current data model.
            // Workaround: We must look up the service duration by name from settings.
            // If name matches perfectly, great. If not (legacy or renamed), assume default.

            let bDuration = 30; // Default buffer
            const services = (await db.getSetting('services')) || [];
            let knownService = services.find(s => s.name === b.service);
            if (!knownService) {
                knownService = services.find(s => s.id === b.service);
            }

            if (knownService && knownService.duration) {
                bDuration = parseInt(knownService.duration);
            }

            occupiedIntervals.push({ start: bStart, end: bStart + bDuration });
        }

        // Add "Lunch Break" if defined for this day
        if (daySettings.breakStart && daySettings.breakEnd) {
            const [bStartH, bStartM] = daySettings.breakStart.split(':').map(Number);
            const [bEndH, bEndM] = daySettings.breakEnd.split(':').map(Number);

            if (!isNaN(bStartH) && !isNaN(bEndH)) {
                const breakStartMin = bStartH * 60 + bStartM;
                const breakEndMin = bEndH * 60 + bEndM;

                if (breakEndMin > breakStartMin) {
                    occupiedIntervals.push({ start: breakStartMin, end: breakEndMin });
                }
            }
        }

        // Add "Lunch Break" or other fixed blocks if any? (Not implemented yet, assuming continuous day)
        console.log('DEBUG: Occupied Intervals:', JSON.stringify(occupiedIntervals));

        // Sort intervals

        // Sort intervals
        occupiedIntervals.sort((a, b) => a.start - b.start);

        // D. Generate Slots using "Tetris" approach
        // We step through the day every 15 minutes (or 5? 15 is standard granularity)
        // Let's use 5 minutes for maximum flexibility if duration is like 20min. 
        // Or 15 min granularity if we want to avoid weird times like 09:07.
        // Let's stick to 10 minute granularity for now to balance flexibility and clean times.
        // D. Generate Slots using "Anchor-Based Dynamic Grid" (Optimized for Gap Minimization)
        // 1. Identify Anchors: Opening Time + End of every Booking
        const anchors = new Set();
        anchors.add(dayStart);
        occupiedIntervals.forEach(interval => {
            if (interval.end >= dayStart && interval.end < dayEnd) {
                anchors.add(interval.end);
            }
        });

        const sortedAnchors = Array.from(anchors).sort((a, b) => a - b);
        const candidateStartTimes = new Set();

        // 2. Generate candidates from each anchor
        for (const anchor of sortedAnchors) {
            let t = anchor;

            // Project forward from anchor until we hit day end or a collision
            while (t <= dayEnd - serviceDuration) {
                const proposedStart = t;
                const proposedEnd = t + serviceDuration;

                // Check collision with any booking
                let isClashing = false;

                for (const interval of occupiedIntervals) {
                    if (proposedStart < interval.end && proposedEnd > interval.start) {
                        isClashing = true;
                        // Optimization: Jump to the end of this blocking booking for the next anchor check
                        // But wait, the outer loop already iterates all anchors (which includes booking ends).
                        // So for this specific anchor sequence, we are dead.
                        break;
                    }
                }

                if (!isClashing) {
                    candidateStartTimes.add(t);
                    t += serviceDuration; // Jump by exact service duration
                } else {
                    break; // Sequence limits reached
                }
            }
        }

        const sortedCandidates = Array.from(candidateStartTimes).sort((a, b) => a - b);
        const timeSlots = [];

        for (const t of sortedCandidates) {
            const h = Math.floor(t / 60);
            const m = t % 60;
            timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }

        // D. (Legacy / Backup) - If you wanted to fallback or merge... but Dynamic Grid replaces Tetris.
        // We will return here.

        /*
        // LEGACY LOGIC REPLACED ABOVE
        const granularity = 10;
        const candidateStartTimes = new Set();
        // ...
        */

        const reason = timeSlots.length === 0 ? 'full' : null;
        return { slots: timeSlots, reason };
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

        return await db.createBooking(name, date, time, service, phone, adminId, email);
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

        // 5. Trigger Processes
        // A. Waitlist
        // We pass the FREED slot details to the waitlist processor
        try {
            await waitingListService.processCancellation(appointment.date, appointment.time, duration, appointment.admin_id);
        } catch (e) {
            console.error('[AppointmentService] Waitlist processing failed:', e);
        }

        // B. Real-time Update
        triggerUpdate();

        return { success: true, appointment };
    }
}

module.exports = new AppointmentService();
