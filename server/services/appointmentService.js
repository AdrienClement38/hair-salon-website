const db = require('../models/database');

class AppointmentService {

    /**
     * Calculate available slots for a given date and admin
     */
    async getAvailableSlots(date, adminId) {
        if (!date) throw new Error('Date required');

        // 1. Check Global Holidays (Dates)
        const holidays = (await db.getSetting('holidays')) || [];
        if (holidays.includes(date)) {
            return [];
        }

        // 2. Check Leaves (Global + Admin Specific)
        // If adminId is provided, we check if THAT admin is on leave.
        // If adminId is NOT provided (e.g. general check), we only check Global leaves.
        const leaves = await db.getLeaves(adminId);

        // Simple string comparison for ISO dates (YYYY-MM-DD)
        const isLeave = leaves.some(leave => {
            return date >= leave.start_date && date <= leave.end_date;
        });

        if (isLeave) {
            return [];
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
            return [];
        }

        // 4. Generate Slots
        const timeSlots = [];
        let current = parseInt(daySettings.open.split(':')[0]);
        const end = parseInt(daySettings.close.split(':')[0]);

        if (isNaN(current) || isNaN(end)) return [];

        for (let h = current; h < end; h++) {
            timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
        }

        // 5. Exclude Booked Slots
        const booked = await db.getBookingsForDate(date, adminId);
        const bookedTimes = booked.map(b => b.time);

        return timeSlots.map(time => ({
            time,
            isAvailable: !bookedTimes.includes(time)
        }));
    }

    async createBooking(data) {
        const { name, date, time, service, phone, adminId } = data;

        // Double check availability (Race condition protection)
        const booked = await db.getBookingsForDate(date, adminId);
        if (booked.some(b => b.time === time)) {
            throw new Error('Slot already booked');
        }

        return await db.createBooking(name, date, time, service, phone, adminId);
    }
}

module.exports = new AppointmentService();
