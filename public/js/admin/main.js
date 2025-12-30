import { initAuth } from './auth.js';
import { initUI } from './ui.js';
import { initCalendar } from './calendar.js';
import { initContentForms } from './content.js';
import { pollUpdates } from './dashboard.js';
import { loadSettings } from './settings.js';

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initUI();
    initCalendar();
    initContentForms();

    // Only load settings if authenticated
    if (localStorage.getItem('auth')) {
        loadSettings();
    }

    // Start polling
    setInterval(pollUpdates, 5000);
});
