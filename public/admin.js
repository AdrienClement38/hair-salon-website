const API_URL = '/api/admin';
// Socket removed. Using Polling.

// LocalStorage Persistence
// let authCreds = JSON.parse(localStorage.getItem('salon_auth')); // This line is removed as per the new auth system

const loginForm = document.getElementById('login-form');
const setupView = document.getElementById('setup-view');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const appointmentsContainer = document.getElementById('appointments-container');

const setupForm = document.getElementById('setup-form');

// --- Auth state ---
let currentUser = null;

// Polling System
let lastDataTimestamp = 0;

async function pollUpdates() {
    if (dashboardView.style.display !== 'block') return; // Don't poll if not logged in

    try {
        const res = await fetch(`/api/updates?lastTimestamp=${lastDataTimestamp}`);
        const data = await res.json();

        if (data.needsUpdate) {
            lastDataTimestamp = data.currentTimestamp;
            console.log('Update detected, refreshing dashboard...');
            loadDashboard(); // Reloads settings and appointments
        }
    } catch (err) {
        console.warn('Polling error:', err);
    }
}
// Start Polling (5s interval)
setInterval(pollUpdates, 5000);

// Initial Check
(async () => {
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();

        if (data.setupRequired) {
            setupView.style.display = 'flex';
            loginView.style.display = 'none';
            dashboardView.style.display = 'none';
        } else {
            verifyAuth();
        }
    } catch (e) {
        console.error("Auth status check failed", e);
        // Fallback to login view
        verifyAuth();
    }
})();

// Helpers
function getHeaders() {
    const auth = localStorage.getItem('auth');
    if (!auth) return {};
    return {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
    };
}

function formatDateDisplay(dateStr) {
    // YYYY-MM-DD -> DD--MM--YYYY
    const parts = dateStr.split('-');
    return `${parts[2]}--${parts[1]}--${parts[0]}`;
}

async function verifyAuth() {
    const auth = localStorage.getItem('auth');
    if (!auth) {
        loginView.style.display = 'flex';
        dashboardView.style.display = 'none';
        setupView.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/appointments`, { headers: getHeaders() });
        if (res.ok) {
            loginView.style.display = 'none';
            dashboardView.style.display = 'block';
            setupView.style.display = 'none';
            loadDashboard();
        } else {
            console.warn('Auth failed or expired');
            localStorage.removeItem('auth');
            loginView.style.display = 'flex';
            dashboardView.style.display = 'none';
            setupView.style.display = 'none';
        }
    } catch (err) {
        console.error(err);
        localStorage.removeItem('auth');
        loginView.style.display = 'flex';
        dashboardView.style.display = 'none';
        setupView.style.display = 'none';
    }
}

// Login
// Setup Handler
setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('setup-username').value;
    const password = document.getElementById('setup-password').value;

    try {
        const res = await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            // Auto login
            const authString = btoa(`${username}:${password}`);
            localStorage.setItem('auth', authString);
            window.location.reload();
        } else {
            alert('Erreur lors de la création du compte');
        }
    } catch (e) {
        alert('Erreur réseau');
    }
});

// Login Handler
// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const authString = btoa(`${username}:${password}`);
            localStorage.setItem('auth', authString);
            verifyAuth();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (e) {
        console.error(e);
        document.getElementById('login-error').style.display = 'block';
    }
});

function logout() {
    localStorage.removeItem('auth');
    location.reload();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    // In a real app we'd toggle the button active class too
}

// Real-time Listeners (Replaced by Polling)

// Data Loading
// Data Loading
async function loadDashboard() {
    await loadSettings(); // Need settings for closing time
    await loadAppointments();
    autoOpenDayDetails();
}

let currentCalendarDate = new Date();
let appointmentsCache = [];
let salonClosingTime = '19:00'; // Default

function autoOpenDayDetails() {
    const now = new Date();
    // Get closing time from variable (populated by loadSettings)
    const [closeHour, closeMinute] = salonClosingTime.split(':').map(Number);

    const closingDate = new Date();
    closingDate.setHours(closeHour, closeMinute, 0, 0);

    let targetDate = new Date(); // Start with today

    // If now is past closing time, switch to tomorrow
    if (now > closingDate) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    const dayAppts = appointmentsCache.filter(a => a.date === dateStr);

    // Auto open
    openDayDetails(dateStr, dayAppts);
}

async function loadAppointments() {
    const res = await fetch(`${API_URL}/appointments`, { headers: getHeaders() });
    appointmentsCache = await res.json();
    renderCalendar();

    // If details section is open, refresh it with new data
    if (currentDetailDate && dayDetailsSection.style.display === 'block') {
        const freshDayAppts = appointmentsCache.filter(a => a.date === currentDetailDate);
        openDayDetails(currentDetailDate, freshDayAppts);
    }
}

// Initialize Year Select
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
// Init once on load
document.addEventListener('DOMContentLoaded', initYearSelect);

function renderCalendar() {
    const grid = document.getElementById('calendar-days');
    if (!grid) return; // Guard for safety
    grid.innerHTML = '';

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Sync Selects
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    if (monthSelect) monthSelect.value = month;
    if (yearSelect) {
        if (!yearSelect.querySelector(`option[value="${year}"]`)) {
            // Add year if missing
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            yearSelect.appendChild(opt);
        }
        yearSelect.value = year;
    }

    // Update Label (Label is redundant now with selects, but keeping for reference or removal)
    // document.getElementById('current-month-label').textContent = `${monthNames[month]} ${year}`; 
    // Actually we removed the label in HTML, so this line is safe to remove or ignore.

    // Calculate dimensions
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Adjust for Monday start (default Date.getDay() 0=Sun, 1=Mon...)
    // We want 0=Mon, 6=Sun
    let startDayIndex = firstDay.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6;

    // Previous Month Fillers
    for (let i = 0; i < startDayIndex; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell empty';
        grid.appendChild(cell);
    }

    // Days
    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Find appointments for this day
        const dayAppts = appointmentsCache.filter(a => a.date === dateStr);

        // Check if holiday
        let isHoliday = false;
        if (currentHolidayRanges) {
            const d = new Date(dateStr);
            for (const range of currentHolidayRanges) {
                // Ensure dates are compared correctly by setting time to 00:00:00
                const rangeStart = new Date(range.start);
                rangeStart.setHours(0, 0, 0, 0);
                const rangeEnd = new Date(range.end);
                rangeEnd.setHours(23, 59, 59, 999); // End of the day

                if (d >= rangeStart && d <= rangeEnd) {
                    isHoliday = true;
                    break;
                }
            }
        }

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        if (dateStr === todayStr) cell.classList.add('today');
        if (isHoliday) {
            cell.style.background = '#ffebee';
            cell.style.borderColor = '#ffcdd2';
        }

        cell.onclick = () => openDayDetails(dateStr, dayAppts);

        // Content
        let html = `<div class="day-number">${day}</div>`;

        if (isHoliday) {
            html += `<span class="appt-badge" style="background:#e57373; color:white">Fermé</span>`;
        } else if (dayAppts.length > 0) {
            html += `<span class="appt-badge has-appt">${dayAppts.length} RDV</span>`;
        } else {
            html += `<span class="appt-badge" style="background:#ddd; color:#666">0 RDV</span>`;
        }

        cell.innerHTML = html;
        grid.appendChild(cell);
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function jumpToDate() {
    const m = parseInt(document.getElementById('calendar-month-select').value);
    const y = parseInt(document.getElementById('calendar-year-select').value);
    currentCalendarDate.setFullYear(y);
    currentCalendarDate.setMonth(m);
    renderCalendar();
}

// Day Details Inline Logic
const dayDetailsSection = document.getElementById('day-details-inline');
let currentDetailDate = null;

function openDayDetails(dateStr, appointments) {
    currentDetailDate = dateStr;
    document.getElementById('details-date-label').textContent = `Détails du ${formatDateDisplay(dateStr)}`;
    const listContainer = document.getElementById('day-appointments-list');

    if (!appointments || appointments.length === 0) {
        listContainer.innerHTML = '<p>Aucun rendez-vous ce jour-là.</p>';
    } else {
        // Sort by time
        appointments.sort((a, b) => a.time.localeCompare(b.time));

        listContainer.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Heure</th>
                        <th>Client</th>
                        <th>Tél</th>
                        <th>Service</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${appointments.map(apt => `
                        <tr>
                            <td>${apt.time}</td>
                            <td>${apt.name}</td>
                            <td>${apt.phone || '-'}</td>
                            <td>${apt.service}</td>
                            <td>
                                <button class="btn-action btn-edit" onclick="openEdit(${apt.id}, '${apt.name.replace("'", "\\'")}', '${apt.date}', '${apt.time}')">Edit</button>
                                <button class="btn-action btn-delete" onclick="deleteApt(${apt.id})">Suppr</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    dayDetailsSection.style.display = 'block';

    // Smooth scroll to details
    dayDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDayDetails() {
    dayDetailsSection.style.display = 'none';
    currentDetailDate = null;
}

// Actions
async function deleteApt(id) {
    if (!confirm('Êtes-vous sûr ?')) return;
    await fetch(`${API_URL}/appointments/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    // Manual reload
    loadAppointments();
}

// Edit Modal
const editModal = document.getElementById('edit-modal');
const editIdInput = document.getElementById('edit-id');
const editTimeInput = document.getElementById('edit-time');

function openEdit(id, name, date, time) {
    editIdInput.value = id;
    document.getElementById('edit-client-name').textContent = name;
    document.getElementById('edit-date-display').textContent = formatDateDisplay(date);
    editTimeInput.value = time;
    editModal.style.display = 'flex';
}

function closeEdit() {
    editModal.style.display = 'none';
}

async function saveEdit() {
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
            // Manual reload
            loadAppointments();
        } else {
            const err = await res.json();
            alert('Erreur: ' + (err.error || 'Impossible de modifier'));
        }
    } catch (e) {
        alert('Erreur réseau');
    }
}


// Settings
// Settings
let currentHolidayRanges = [];

async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        const { openingHours, holidayRanges } = await res.json();

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

        // Update global closing time (take generic or max? let's take today's or default)
        // For dashboard auto-close logic, maybe just use 19:00 or try to find today's close
        const todayIdx = new Date().getDay();
        salonClosingTime = schedule[todayIdx]?.close || '19:00';

        renderScheduleTable(schedule);
        renderHolidayList();

        // Refresh calendar
        loadAppointments();
    } catch (e) {
        console.error('Error loading settings', e);
    }
}

function renderScheduleTable(schedule) {
    const tbody = document.getElementById('schedule-tbody');
    tbody.innerHTML = '';

    // Days names in order 0..6 (Sun..Sat) or 1..6,0 (Mon..Sun)?
    // JS getDay() is 0=Sun. Let's list Mon(1) -> Sun(0) for UI friendliness
    // But data is index-based 0-6.

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

function toggleRow(checkbox) {
    const tr = checkbox.closest('tr');
    const inputs = tr.querySelectorAll('input[type="time"]');
    inputs.forEach(inp => inp.disabled = !checkbox.checked);
}

function copyMondayToAll() {
    // Find Monday row (data-day="1")
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
        toggleRow(tr.querySelector('.sched-open')); // updates disabled state
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

function addHolidayRange() {
    const start = document.getElementById('holiday-start').value;
    const end = document.getElementById('holiday-end').value;

    if (!start || !end) return alert('Dates incomplètes');
    if (start > end) return alert('La date de début doit être avant la fin');

    currentHolidayRanges.push({ start, end });
    currentHolidayRanges.sort((a, b) => a.start.localeCompare(b.start));

    // Clear inputs
    document.getElementById('holiday-start').value = '';
    document.getElementById('holiday-end').value = '';

    renderHolidayList();
}

function removeHolidayRange(index) {
    if (!confirm('Supprimer cette période ?')) return;
    currentHolidayRanges.splice(index, 1);
    renderHolidayList();
}

async function saveSettings() {
    // Collect Schedule
    const schedule = []; // Array(7)
    const tbody = document.getElementById('schedule-tbody');
    const rows = tbody.querySelectorAll('tr');

    // We need to put them back in index 0-6 order
    // Iterate rows and place in correct index
    rows.forEach(tr => {
        const idx = parseInt(tr.dataset.day);
        const isOpen = tr.querySelector('.sched-open').checked;
        const open = tr.querySelector('.sched-start').value;
        const close = tr.querySelector('.sched-end').value;

        schedule[idx] = { isOpen, open, close };
    });

    // Flatten Ranges to individual dates
    const holidays = [];
    currentHolidayRanges.forEach(range => {
        let curr = new Date(range.start);
        const last = new Date(range.end);

        while (curr <= last) {
            holidays.push(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
        }
    });

    const rangesToSend = Array.isArray(currentHolidayRanges) ? currentHolidayRanges : [];

    const settings = {
        openingHours: schedule, // New Array Structure
        holidays,
        holidayRanges: rangesToSend
    };

    await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings)
    });

    alert('Configuration enregistrée !');
    loadAppointments();
}

// Photos
document.getElementById('upload-hero').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + btoa(authCreds.user + ':' + authCreds.pass) },
        body: formData
    });
    alert('Image mise à jour !');
});
