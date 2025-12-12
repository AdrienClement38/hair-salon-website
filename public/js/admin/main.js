// public/js/admin/main.js
import { initAuth } from './auth.js';
import { initUI } from './ui.js';
import { initCalendar } from './calendar.js';
import { initContentForms } from './content.js';
import { pollUpdates } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initUI();
    initCalendar();
    initContentForms();

    // Start polling
    setInterval(pollUpdates, 5000);
});
