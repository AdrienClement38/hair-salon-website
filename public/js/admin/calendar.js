import { API_URL, getHeaders, formatDateDisplay } from './config.js';
import { currentSchedule, currentLeaves, salonClosingTime } from './state.js';

let appointmentsCache = [];
let currentCalendarDate = new Date();
let currentWorkers = [];
let currentDetailDate = null;

// DOM Elements
const dayDetailsSection = document.getElementById('day-details-inline');
const editModal = document.getElementById('edit-modal');
const editIdInput = document.getElementById('edit-id');
const editTimeInput = document.getElementById('edit-time');

export function initCalendar() {
    initYearSelect();
    loadWorkersForFilter();
    // Start polling or load initial
}

function initYearSelect() {
    const yearSelect = document.getElementById('calendar-year-select');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear - 2; y <= currentYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
}

async function loadWorkersForFilter() {
    try {
        const res = await fetch('/api/workers');
        const workers = await res.json();
        currentWorkers = workers;
        const select = document.getElementById('admin-filter');

        // Keep first option (All)
        select.innerHTML = '<option value="">Tous les RDV</option>';

        workers.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to load workers', e);
    }
}

export async function loadAppointments() {
    const filter = document.getElementById('admin-filter') ? document.getElementById('admin-filter').value : '';
    const url = filter ? `${API_URL}/appointments?adminId=${filter}` : `${API_URL}/appointments`;

    try {
        const res = await fetch(url, { headers: getHeaders() });
        appointmentsCache = await res.json();
        renderCalendar();

        // If details section is open, refresh it with new data
        if (currentDetailDate && dayDetailsSection && dayDetailsSection.style.display === 'block') {
            const freshDayAppts = appointmentsCache.filter(a => a.date === currentDetailDate);
            openDayDetails(currentDetailDate, freshDayAppts, false);
        }
    } catch (e) {
        console.error(e);
    }
}

export function autoOpenDayDetails() {
    const now = new Date();
    // Get closing time from variable
    const [closeHour, closeMinute] = salonClosingTime.split(':').map(Number);

    const closingDate = new Date();
    closingDate.setHours(closeHour, closeMinute, 0, 0);

    let targetDate = new Date(); // Start with today

    // If now is past closing time, switch to tomorrow
    if (now > closingDate) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    // const dateStr = targetDate.toISOString().split('T')[0];
    const dayAppts = appointmentsCache.filter(a => a.date === dateStr);

    // Auto open
    openDayDetails(dateStr, dayAppts);
}

function renderCalendar() {
    const grid = document.getElementById('calendar-days');
    if (!grid) return;
    grid.innerHTML = '';

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Sync Selects
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    if (monthSelect) monthSelect.value = month;
    if (yearSelect) {
        if (!yearSelect.querySelector(`option[value="${year}"]`)) {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            yearSelect.appendChild(opt);
        }
        yearSelect.value = year;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // 0=Mon, 6=Sun
    let startDayIndex = firstDay.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6;

    // Previous Month Fillers
    for (let i = 0; i < startDayIndex; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell empty';
        grid.appendChild(cell);
    }

    // Use Local Date for "today" check
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
    const todayDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
    // const todayStr = new Date().toISOString().split('T')[0];
    const activeFilter = document.getElementById('admin-filter') ? document.getElementById('admin-filter').value : '';

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(dateStr);
        const dayOfWeekIndex = dayDate.getDay();

        const dayAppts = appointmentsCache.filter(a => a.date === dateStr);

        // Check Holidays
        let holidayType = null; // 'global' or 'personal'

        if (currentLeaves && currentLeaves.length > 0) {
            // Prioritize Global to block everything
            const globalLeaves = currentLeaves.filter(l => l.admin_id === null);
            for (const leave of globalLeaves) {
                const start = new Date(leave.start_date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(leave.end_date);
                end.setHours(23, 59, 59, 999);
                if (dayDate >= start && dayDate <= end) {
                    holidayType = 'global';
                    break;
                }
            }

            // If not global, check personal matches (if filter is active)
            if (!holidayType && activeFilter) {
                const personalLeaves = currentLeaves.filter(l => l.admin_id == activeFilter);
                for (const leave of personalLeaves) {
                    const start = new Date(leave.start_date);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(leave.end_date);
                    end.setHours(23, 59, 59, 999);
                    if (dayDate >= start && dayDate <= end) {
                        holidayType = 'personal';
                        break;
                    }
                }
            }
        }

        const dayConfig = currentSchedule[dayOfWeekIndex];
        const isClosedDay = dayConfig && !dayConfig.isOpen;

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        if (dateStr === todayStr) cell.classList.add('today');

        if (holidayType === 'global') {
            cell.style.background = '#ffebee';
            cell.style.borderColor = '#ef9a9a';
        } else if (holidayType === 'personal') {
            cell.style.background = '#fff3e0'; // Orange light
            cell.style.borderColor = '#ffcc80';
        } else if (isClosedDay) {
            cell.style.background = '#f5f5f5';
        }

        cell.onclick = () => openDayDetails(dateStr, dayAppts);

        let html = `<div class="day-number">${day}</div>`;

        if (holidayType === 'global') {
            html += `<span class="appt-badge" style="background:#e57373; color:white">Fermeture Salon</span>`;
        } else if (holidayType === 'personal') {
            html += `<span class="appt-badge" style="background:#ffa726; color:white">Congés</span>`;
        } else if (isClosedDay) {
            html += `<span class="appt-badge" style="background:#bdbdbd; color:white">Fermé</span>`;
        } else {
            if (activeFilter) {
                if (dayAppts.length > 0) {
                    html += `<span class="appt-badge has-appt" style="display:block; margin-top:2px;">${dayAppts.length} RDV</span>`;
                } else {
                    html += `<span class="appt-badge" style="background:#eee; color:#999; display:block; margin-top:2px;">0 RDV</span>`;
                }
            } else {
                if (dayAppts.length === 0) {
                    html += `<span class="appt-badge" style="background:#eee; color:#999; display:block; margin-top:2px;">0 RDV</span>`;
                } else {
                    const counts = {};
                    dayAppts.forEach(appt => {
                        const id = appt.admin_id || 'null';
                        counts[id] = (counts[id] || 0) + 1;
                    });

                    Object.keys(counts).forEach(adminId => {
                        const count = counts[adminId];
                        let name = "Autre";
                        if (adminId !== 'null') {
                            const worker = currentWorkers.find(w => w.id == adminId);
                            name = worker ? worker.name : 'Inconnu';
                        }
                        html += `<span class="appt-badge has-appt" style="display:block; margin-top:2px; font-size:0.75rem;">${name}: ${count}</span>`;
                    });
                }
            }
        }

        cell.innerHTML = html;
        grid.appendChild(cell);
    }
}

export function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

export function jumpToDate() {
    const m = parseInt(document.getElementById('calendar-month-select').value);
    const y = parseInt(document.getElementById('calendar-year-select').value);
    currentCalendarDate.setFullYear(y);
    currentCalendarDate.setMonth(m);
    renderCalendar();
}

function openDayDetails(dateStr, appointments, shouldScroll = true) {
    currentDetailDate = dateStr;
    document.getElementById('details-date-label').textContent = `Détails du ${formatDateDisplay(dateStr)}`;
    const listContainer = document.getElementById('day-appointments-list');

    if (!appointments || appointments.length === 0) {
        listContainer.innerHTML = '<p>Aucun rendez-vous ce jour-là.</p>';
    } else {
        appointments.sort((a, b) => a.time.localeCompare(b.time));

        listContainer.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Heure</th>
                        <th>Client</th>
                        <th>Coiffeur</th>
                        <th>Tél</th>
                        <th>Service</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${appointments.map(apt => {
            let workerName = "Autre";
            if (apt.admin_id) {
                const w = currentWorkers.find(worker => worker.id == apt.admin_id);
                if (w) workerName = w.name;
            }

            return `
                        <tr>
                            <td>${apt.time}</td>
                            <td>${apt.name}</td>
                            <td><span class="appt-badge">${workerName}</span></td>
                            <td>${apt.phone || '-'}</td>
                            <td>${apt.service}</td>
                            <td>
                                <button class="btn-action btn-edit" onclick="openEdit(${apt.id}, '${apt.name.replace("'", "\\'")}', '${apt.date}', '${apt.time}')">Edit</button>
                                <button class="btn-action btn-delete" onclick="deleteApt(${apt.id})">Suppr</button>
                            </td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;
    }

    dayDetailsSection.style.display = 'block';

    if (shouldScroll) {
        dayDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function closeDayDetails() {
    dayDetailsSection.style.display = 'none';
    currentDetailDate = null;
}

export async function deleteApt(id) {
    if (!confirm('Êtes-vous sûr ?')) return;
    await fetch(`${API_URL}/appointments/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    loadAppointments();
}

// Edit Modal Functions
export function openEdit(id, name, date, time) {
    editIdInput.value = id;
    document.getElementById('edit-client-name').textContent = name;
    document.getElementById('edit-date-display').textContent = formatDateDisplay(date);
    editTimeInput.value = time;
    editModal.style.display = 'flex';
}

export function closeEdit() {
    editModal.style.display = 'none';
}

export async function saveEdit() {
    const id = editIdInput.value;
    const time = editTimeInput.value;

    if (!time) return alert('Heure requise');

    try {
        const res = await fetch(`${API_URL}/appointments/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ time })
        });

        if (res.ok) {
            closeEdit();
            loadAppointments();
        } else {
            const err = await res.json();
            alert('Erreur: ' + (err.error || 'Impossible de modifier'));
        }
    } catch (e) {
        alert('Erreur réseau');
    }
}

// Global exposure
window.changeMonth = changeMonth;
window.jumpToDate = jumpToDate;
window.closeDayDetails = closeDayDetails;
window.deleteApt = deleteApt;
window.openEdit = openEdit;
window.closeEdit = closeEdit;
window.saveEdit = saveEdit;
window.loadAppointments = loadAppointments; 
