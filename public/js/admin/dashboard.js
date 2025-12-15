import { API_URL, getHeaders } from './config.js';
import { loadSettings } from './settings.js';
import { loadAppointments, autoOpenDayDetails } from './calendar.js';

let lastSettingsTS = Date.now();
let lastApptTS = Date.now();

export async function loadDashboard(isInitial = false) {
    await loadSettings();
    await loadAppointments();
    loadCurrentUser();
    if (isInitial) {
        autoOpenDayDetails();
    }
}

async function loadCurrentUser() {
    try {
        const res = await fetch(`${API_URL}/me`, { headers: getHeaders() });
        const user = await res.json();

        // Populate Profile Form - HANDLED IN settings.js dynamically
        // const displayInput = document.getElementById('profile-displayname');
        // if (displayInput && user.displayName) {
        //    displayInput.value = user.displayName;
        // }

        // Maybe show name in header
        const headerTitle = document.querySelector('#dashboard-view header h1');
        if (headerTitle) {
            // headerTitle.textContent = `Tableau de Bord - ${user.displayName}`;
        }

    } catch (e) {
        console.error('Failed to load user info', e);
    }
}

// Polling System

export async function pollUpdates() {
    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView.style.display !== 'block') return;

    try {
        const res = await fetch(`/api/updates?lastSettings=${lastSettingsTS}&lastAppt=${lastApptTS}`, { headers: getHeaders() });
        const data = await res.json();

        // console.log('[Polling] Response:', data);

        let settingsChanged = false;
        let apptChanged = false;

        if (data.needsSettingsUpdate) {
            console.log('Settings update detected');
            lastSettingsTS = data.settingsTimestamp;
            await loadSettings();
            settingsChanged = true;
        }

        if (data.needsApptUpdate) {
            console.log('Appt update detected');
            lastApptTS = data.apptTimestamp;
            await loadAppointments();
            apptChanged = true;
        }

    } catch (e) {
        console.error('Polling error', e);
    }
}
