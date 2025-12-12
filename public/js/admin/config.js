// public/js/admin/config.js

export const API_URL = '/api/admin';

export function getHeaders() {
    const auth = localStorage.getItem('auth');
    if (!auth) return {};
    return {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
    };
}

export function formatDateDisplay(dateStr) {
    // YYYY-MM-DD -> DD--MM--YYYY
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
