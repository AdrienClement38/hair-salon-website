// public/js/admin/dashboard.js
import { apiFetch } from '../utils/api.js';
import { loadSettings } from './settings.js';
import { loadAppointments, autoOpenDayDetails } from './calendar.js';

let pollingInterval = null;

export async function loadDashboard(isInitial = false) {
    await loadSettings();
    await loadAppointments();
    loadCurrentUser();
    if (isInitial) {
        autoOpenDayDetails();
        startPolling();
    }
}

async function loadCurrentUser() {
    try {
        const res = await apiFetch('api/auth_status.php');
        const data = await res.json();
        // User data might be in data.user if authenticated
    } catch (e) { console.error(e); }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        const dashboard = document.getElementById('dashboard-view');
        if (dashboard && dashboard.style.display !== 'none') {
            loadAppointments();
        }
    }, 5000); // 5 seconds
}
