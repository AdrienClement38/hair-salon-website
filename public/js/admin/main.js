import { initAuth } from './auth.js';
import { initUI } from './ui.js';
import { initCalendar } from './calendar.js';
import { initContentForms } from './content.js';
import { pollUpdates } from './dashboard.js';
import { loadSettings } from './settings.js?v=12';

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initUI();
    initCalendar();
    initContentForms();

    // Only load settings if authenticated
    if (localStorage.getItem('auth')) {
        loadSettings();
        // Trigger manual waitlist scan
        fetch('/api/waiting-list/scan', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth') }
        }).catch(err => console.error('Scan Error:', err));
    }

    // Start polling
    setInterval(pollUpdates, 5000);
});
