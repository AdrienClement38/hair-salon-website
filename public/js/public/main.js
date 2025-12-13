import { initBooking, refreshSlots, loadServices as refreshBookingServices } from './booking.js';
import { renderOpeningHours, renderHolidays, renderHomeContent, renderServices, refreshImages, renderContactInfo } from './ui.js';

let lastSettingsTS = Date.now();
let lastApptTS = Date.now();

// Poll Updates
async function pollUpdates() {
    try {
        const res = await fetch(`/api/updates?lastSettings=${lastSettingsTS}&lastAppt=${lastApptTS}`);
        const data = await res.json();

        if (data.needsSettingsUpdate) {
            console.log('Settings update detected');
            lastSettingsTS = data.settingsTimestamp;
            loadSettings();
            refreshBookingServices(); // Update booking dropdown

            // Refresh Images
            refreshImages();
        }

        if (data.needsApptUpdate) {
            console.log('Appt update detected');
            lastApptTS = data.apptTimestamp;
            refreshSlots();
        }

    } catch (err) {
        console.warn('Polling error:', err);
    }
}

// Load Settings
async function loadSettings() {
    try {
        console.log("Fetching settings...");
        const res = await fetch(`/api/settings`);
        const { openingHours, holidayRanges, home_content, services, contact_info } = await res.json();

        renderOpeningHours(openingHours);
        renderHolidays(holidayRanges);
        renderHomeContent(home_content);
        renderServices(services);
        renderContactInfo(contact_info);

    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initBooking();
    loadSettings();

    // Start polling
    setInterval(pollUpdates, 5000);
});
