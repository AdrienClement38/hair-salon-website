import { initBooking, refreshSlots } from './booking.js';
import { renderOpeningHours, renderHolidays, renderHomeContent, renderServices, refreshHeroBG } from './ui.js';

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

            // Refresh Hero BG
            refreshHeroBG();
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
        const { openingHours, holidayRanges, home_content, services } = await res.json();

        renderOpeningHours(openingHours);
        renderHolidays(holidayRanges);
        renderHomeContent(home_content);
        renderServices(services);

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
