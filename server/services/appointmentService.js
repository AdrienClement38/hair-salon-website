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

        // 1. Check Global Holidays (Dates)
        const holidays = (await db.getSetting('holidays')) || [];
        if (holidays.includes(date)) {
            return { slots: [], reason: 'holiday' };
        }

        // 2. Check Leaves (Global + Admin Specific)
        const leaves = await db.getLeaves(adminId);
        const isLeave = leaves.some(leave => {
            return date >= leave.start_date && date <= leave.end_date;
        });

        if (isLeave) {
            return { slots: [], reason: 'leave' };
        }

        // 3. Get Opening Hours
        let openingHours = await db.getSetting('openingHours');
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
        const { name, date, time, service, phone, adminId } = data;

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

        return await db.createBooking(name, date, time, service, phone, adminId);
    }
}

module.exports = new AppointmentService();
