// public/js/admin/settings.js
import { API_URL, getHeaders, formatDateDisplay } from './config.js';
import { renderServicesList, setServicesData } from './services.js';
import { loadAppointments } from './calendar.js';

let currentHolidayRanges = [];
let currentServices = [];
let currentHomeContent = {};
export let salonClosingTime = '19:00'; // Default
export let currentSchedule = []; // Store schedule for closed days check

export async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        const { openingHours, holidays, holidayRanges, home_content, services } = await res.json();

        currentHolidayRanges = Array.isArray(holidayRanges) ? holidayRanges : [];

        // Determine format: Array (New) or Object (Old)
        let schedule = [];
        if (Array.isArray(openingHours)) {
            schedule = openingHours;
        } else {
            // Migration from Old
            const start = openingHours?.start || '09:00';
            const end = openingHours?.end || '18:00';
            const closed = openingHours?.closedDays || [];

            // Generate 7 days (0=Sun, 1=Mon...)
            for (let i = 0; i < 7; i++) {
                schedule[i] = {
                    open: start,
                    close: end,
                    isOpen: !closed.includes(i)
                };
            }
        }

        // Update global closing time
        const todayIdx = new Date().getDay();
        salonClosingTime = schedule[todayIdx]?.close || '19:00';

        currentSchedule = schedule;

        renderScheduleTable(schedule);
        renderHolidayList();

        // Populate Content Tab
        // Pass services to service module
        setServicesData(services || []);
        currentHomeContent = home_content || {};
        renderServicesList();

        // Populate Texts
        if (document.getElementById('content-title')) document.getElementById('content-title').value = currentHomeContent.title || '';
        if (document.getElementById('content-subtitle')) document.getElementById('content-subtitle').value = currentHomeContent.subtitle || '';
        if (document.getElementById('content-philosophy')) document.getElementById('content-philosophy').value = currentHomeContent.philosophy || '';

        // Refresh calendar (it might need the updated schedule)
        // loadAppointments is imported from calendar.js
        loadAppointments();

    } catch (e) {
        console.error('Error loading settings', e);
    }
}

function renderScheduleTable(schedule) {
    const tbody = document.getElementById('schedule-tbody');
    tbody.innerHTML = '';

    // UI Order: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const uiOrder = [1, 2, 3, 4, 5, 6, 0];
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    uiOrder.forEach(dayIdx => {
        const dayData = schedule[dayIdx] || { open: '09:00', close: '18:00', isOpen: true };
        const tr = document.createElement('tr');
        tr.dataset.day = dayIdx; // Store index

        tr.innerHTML = `
            <td><strong>${dayNames[dayIdx]}</strong></td>
            <td><input type="checkbox" class="sched-open" ${dayData.isOpen ? 'checked' : ''} onchange="toggleRow(this)"></td>
            <td><input type="time" class="sched-start" value="${dayData.open}" ${!dayData.isOpen ? 'disabled' : ''}></td>
            <td><input type="time" class="sched-end" value="${dayData.close}" ${!dayData.isOpen ? 'disabled' : ''}></td>
        `;
        tbody.appendChild(tr);
    });
}

export function toggleRow(checkbox) {
    const tr = checkbox.closest('tr');
    const inputs = tr.querySelectorAll('input[type="time"]');
    inputs.forEach(inp => inp.disabled = !checkbox.checked);
}

export function copyMondayToAll() {
    const tbody = document.getElementById('schedule-tbody');
    const monRow = tbody.querySelector('tr[data-day="1"]');
    if (!monRow) return;

    const isOpen = monRow.querySelector('.sched-open').checked;
    const start = monRow.querySelector('.sched-start').value;
    const end = monRow.querySelector('.sched-end').value;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(tr => {
        if (tr === monRow) return;
        tr.querySelector('.sched-open').checked = isOpen;
        tr.querySelector('.sched-start').value = start;
        tr.querySelector('.sched-end').value = end;
        toggleRow(tr.querySelector('.sched-open'));
    });
}

function renderHolidayList() {
    const list = document.getElementById('holiday-list');
    list.innerHTML = '';

    if (currentHolidayRanges.length === 0) {
        list.innerHTML = '<p style="color:#666; font-style:italic;">Aucune période configurée.</p>';
        return;
    }

    currentHolidayRanges.forEach((range, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#f4f4f4; padding:10px; margin-bottom:5px; border-radius:4px;';

        item.innerHTML = `
            <span><strong>${formatDateDisplay(range.start)}</strong> au <strong>${formatDateDisplay(range.end)}</strong></span>
            <button onclick="removeHolidayRange(${index})" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold;">Supprimer</button>
        `;
        list.appendChild(item);
    });
}

export function addHolidayRange() {
    const start = document.getElementById('holiday-start').value;
    const end = document.getElementById('holiday-end').value;

    if (!start || !end) return alert('Dates incomplètes');
    if (start > end) return alert('La date de début doit être avant la fin');

    currentHolidayRanges.push({ start, end });
    currentHolidayRanges.sort((a, b) => a.start.localeCompare(b.start));

    document.getElementById('holiday-start').value = '';
    document.getElementById('holiday-end').value = '';

    renderHolidayList();
}

export function removeHolidayRange(index) {
    if (!confirm('Supprimer cette période ?')) return;
    currentHolidayRanges.splice(index, 1);
    renderHolidayList();
}

export async function saveSchedule() {
    const schedule = [];
    const tbody = document.getElementById('schedule-tbody');
    const rows = tbody.querySelectorAll('tr');

    rows.forEach(tr => {
        const idx = parseInt(tr.dataset.day);
        const isOpen = tr.querySelector('.sched-open').checked;
        const open = tr.querySelector('.sched-start').value;
        const close = tr.querySelector('.sched-end').value;
        schedule[idx] = { isOpen, open, close };
    });

    const settings = { openingHours: schedule };

    try {
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        alert('Horaires enregistrés !');
        loadAppointments();
    } catch (e) {
        alert('Erreur lors de la sauvegarde');
    }
}

export async function saveHolidays() {
    const settings = { holidayRanges: currentHolidayRanges };
    try {
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        alert('Congés enregistrés !');
        loadAppointments();
    } catch (e) {
        alert('Erreur lors de la sauvegarde');
    }
}

// Global exposure
window.toggleRow = toggleRow;
window.copyMondayToAll = copyMondayToAll;
window.addHolidayRange = addHolidayRange;
window.removeHolidayRange = removeHolidayRange;
window.saveSchedule = saveSchedule;
window.saveHolidays = saveHolidays;

export { currentHolidayRanges }; // If needed by calendar
