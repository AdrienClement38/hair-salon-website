import { API_URL, getHeaders, formatDateDisplay } from './config.js';
import { currentSchedule, currentLeaves, salonClosingTime } from './state.js';
import { renderActionButtons } from './ui-components.js';

let appointmentsCache = [];
let currentCalendarDate = new Date();
let currentWorkers = [];
let currentDetailDate = null;
let currentAppointments = [];

// DOM Elements
const dayDetailsSection = document.getElementById('day-details-inline');
const editModal = document.getElementById('edit-modal');
const editIdInput = document.getElementById('edit-id');
const editTimeInput = document.getElementById('edit-time');

// Global Polling Interval
let calendarPollingInterval = null;

export function initCalendar() {
    initYearSelect();
    loadWorkersForFilter();

    // Initialize Filters from LocalStorage & Add Listeners
    const filters = [
        { id: 'cb-weekly-off', key: 'filter-weekly-off' },
        { id: 'cb-leaves', key: 'filter-leaves' },
        { id: 'cb-closures', key: 'filter-closures' }
    ];

    filters.forEach(f => {
        const el = document.getElementById(f.id);
        if (el) {
            // Restore state (default to true if not set)
            const saved = localStorage.getItem(f.key);
            if (saved !== null) {
                el.checked = saved === 'true';
            } else {
                el.checked = true; // Default to checked
            }

            // Save state on change
            el.addEventListener('change', () => {
                localStorage.setItem(f.key, el.checked);
                loadAppointments();
            });
        }
    });

    // Listen to worker filter change (already persisted in loadWorkersForFilter logic partly, but let's confirm)
    const filterEl = document.getElementById('admin-filter');
    if (filterEl) {
        filterEl.addEventListener('change', (e) => {
            const val = e.target.value;
            localStorage.setItem('adminFilter', val);
            loadAppointments();

            // Auto-fill Profile (if function exists)
            if (typeof updateProfileInputs === 'function') {
                updateProfileInputs(val);
            }
        });
    }

    // Load services for ID lookup
    loadServicesForCalendar();

    // Start Global Polling (Every 10 seconds)
    if (calendarPollingInterval) clearInterval(calendarPollingInterval);
    calendarPollingInterval = setInterval(() => {
        // Refresh Appointments (which triggers renderCalendar)
        // This keeps the Grid View Badges up to date
        loadAppointments();
    }, 10000);
}

async function loadServicesForCalendar() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        window.currentServices = settings.services || [];
    } catch (e) {
        console.error('Failed to load services for calendar', e);
    }
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

export async function loadWorkersForFilter() {
    try {
        // Use Admin Endpoint to get full details (username, etc.)
        const res = await fetch('/api/admin/workers', { headers: getHeaders() });
        const workers = await res.json();

        // Map for compatibility with existing code expecting 'name'
        currentWorkers = workers.map(w => ({
            ...w,
            name: w.displayName || w.username // Ensure 'name' property exists
        }));

        const select = document.getElementById('admin-filter');
        const currentValue = select.value;

        // Keep first option (All)
        select.innerHTML = '<option value="">Salon</option>';

        currentWorkers.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name;
            select.appendChild(opt);
        });

        // Add Auto-fill Listener (if not already added, but adding here ensures it uses fresh closure scope if needed, 
        // though typically listeners should be in init. Ideally we add it once in init, but here we have the select element ready.)
        // To avoid duplicates, we can check a flag or just rely on initCalendar's listener.
        // BUT initCalendar already adds a listener. We should EXTEND that one or handle it here?
        // Let's handle the Auto-fill in the existing listener in initCalendar or just add a second one?
        // Adding a second one is fine.

        // Remove old listener if any? Hard to remove anonymous. 
        // Let's just update the logic in initCalendar instead? 
        // No, let's add a named function and attach it to avoid duplication if re-run.
        // Actually, loadWorkersForFilter is called once usually.
    } catch (e) {
        console.error('Failed to load workers', e);
    }

    // Resume selection
    const select = document.getElementById('admin-filter');
    const saved = localStorage.getItem('adminFilter');
    if (saved && select.querySelector(`option[value="${saved}"]`)) {
        select.value = saved;

        // Trigger Auto-fill immediately on load if value is present
        updateProfileInputs(saved);

        loadAppointments();
    } else {
        // Ensure default state (hidden profile)
        updateProfileInputs('');
    }
}

// Helper to fill inputs
function updateProfileInputs(adminId) {
    const profileSection = document.getElementById('profile-section');
    const profileUser = document.getElementById('profile-username');
    const profileDisplay = document.getElementById('profile-displayname');

    // Toggle visibility based on selection
    if (profileSection) {
        if (!adminId) {
            profileSection.style.display = 'none';
        } else {
            profileSection.style.display = 'block';
        }
    }

    if (profileUser && profileDisplay && adminId) {
        const worker = currentWorkers.find(w => w.id == adminId);
        if (worker) {
            profileUser.value = worker.username || '';
            profileDisplay.value = worker.displayName || worker.name || '';
        }
    }
}

export async function loadAppointments() {
    const filter = document.getElementById('admin-filter') ? document.getElementById('admin-filter').value : '';
    const url = filter ? `${API_URL}/appointments?adminId=${filter}` : `${API_URL}/appointments`;

    try {
        // Update Title dynamically
        const headerTitle = document.querySelector('header h1');
        if (headerTitle) {
            const filterEl = document.getElementById('admin-filter');
            const selectedText = filterEl.options[filterEl.selectedIndex]?.text || 'Salon';
            headerTitle.textContent = `Tableau de Bord - ${selectedText}`;
        }

        const res = await fetch(url, { headers: getHeaders() });
        const allAppointments = await res.json();
        // Filter out HOLD appointments (Waitlist offers) to prevent them from appearing in the main agenda
        // They are handled by the Waitlist UI (Orange Badges).
        appointmentsCache = allAppointments;
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
    const activeFilter = document.getElementById('admin-filter') ? document.getElementById('admin-filter').value : '';

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(dateStr);
        const dayOfWeekIndex = dayDate.getDay(); // 0=Sun, 1=Mon

        const dayAppts = appointmentsCache.filter(a => a.date === dateStr);

        // Determine Status
        let status = 'open'; // open, closed-regular, closed-exception, leave, weekly-off
        // Status hierarchy: closed-exception > closed-regular > leave > weekly-off > open

        // Check Filter Visibility
        const showWeeklyOff = document.getElementById('cb-weekly-off') ? document.getElementById('cb-weekly-off').checked : true;
        const showLeaves = document.getElementById('cb-leaves') ? document.getElementById('cb-leaves').checked : true;
        const showClosures = document.getElementById('cb-closures') ? document.getElementById('cb-closures').checked : true;

        // 1. Global Exception (Red) - Takes precedence
        if (currentLeaves && currentLeaves.length > 0) {
            const globalLeaves = currentLeaves.filter(l => l.admin_id === null);
            for (const leave of globalLeaves) {
                const start = new Date(leave.start_date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(leave.end_date);
                end.setHours(23, 59, 59, 999);
                if (dayDate >= start && dayDate <= end) {
                    if (showClosures) {
                        status = 'closed-exception';
                    }
                    break;
                }
            }
        }

        // 2. Regular Closure (Grey) - If not exception
        // Note: Regular closures (Schedule) are usually not toggleable via these filters, 
        // asking user implied "Fermeture Salon" which usually means exception, but maybe also regular? 
        // The prompt said "fermeture salon", which maps to Exception. 
        if (status === 'open') {
            const dayConfig = currentSchedule[dayOfWeekIndex]; // currentSchedule uses 0=Sun, 1=Mon matches dayOfWeekIndex
            if (dayConfig && !dayConfig.isOpen) {
                status = 'closed-regular';
            }
        }

        // 3. Personal Status (Leave or Weekly Off) - Only if specific worker selected
        if (status === 'open' && activeFilter && activeFilter !== "") {
            // Check Personal Leave (Orange)
            const personalLeaves = currentLeaves ? currentLeaves.filter(l => l.admin_id == activeFilter) : [];
            for (const leave of personalLeaves) {
                const start = new Date(leave.start_date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(leave.end_date);
                end.setHours(23, 59, 59, 999);
                if (dayDate >= start && dayDate <= end) {
                    if (showLeaves) {
                        status = 'leave';
                    }
                    break;
                }
            }

            // Check Weekly Off (Blue) - If not on leave
            if (status === 'open') {
                const worker = currentWorkers ? currentWorkers.find(w => w.id == activeFilter) : null;
                if (worker) {
                    const daysOff = worker.daysOff || [];
                    if (Array.isArray(daysOff) && daysOff.includes(dayOfWeekIndex)) {
                        if (showWeeklyOff) {
                            status = 'weekly-off';
                        }
                    }
                }
            }
        }

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        if (dateStr === todayStr) cell.classList.add('today');

        // Apply Classes
        if (status === 'closed-exception') cell.classList.add('status-holiday');
        else if (status === 'closed-regular') cell.classList.add('status-closed-regular');
        else if (status === 'leave') cell.classList.add('status-leave');
        else if (status === 'weekly-off') cell.classList.add('status-weekly-off');

        cell.onclick = () => openDayDetails(dateStr, dayAppts);

        let html = `<div class="day-number">${day}</div>`;

        // Render Badges
        if (status === 'closed-regular') {
            // Grey (#f5f5f5 is BG, so Badge should be visible, or use standard grey)
            // User requested: "Gris (#f5f5f5) : Jours de fermeture habituelle... -> Badge 'Fermé'."
            // Since BG is light grey, a darker grey badge is better for contrast, or just a generic 'secondary' style.
            html += `<span class="appt-badge" style="background:#757575; color:white">Fermé</span>`;
        } else if (status === 'closed-exception') {
            // Red (#e57373)
            html += `<span class="appt-badge" style="background:#e57373; color:white">Fermeture Salon</span>`;
        } else if (status === 'leave') {
            // Orange (#ffa726)
            html += `<span class="appt-badge" style="background:#ffa726; color:white">Congés</span>`;
        } else if (status === 'weekly-off') {
            // Blue
            // User requested: "Bleu (#e3f2fd) : Jour de Repos Hebdo... -> Badge 'Repos'."
            // #e3f2fd is very light. Using a darker blue for badge.
            html += `<span class="appt-badge" style="background:#2196f3; color:white">Repos</span>`;
        } else {
            // Open Day - Show Appointments
            if (activeFilter) {
                // Specific Worker View
                if (dayAppts.length > 0) {
                    html += `<span class="appt-badge has-appt" style="display:block; margin-top:2px;">${dayAppts.length} RDV</span>`;
                } else {
                    html += `<span class="appt-badge" style="background:#eee; color:#999; display:block; margin-top:2px;">0 RDV</span>`;
                }
            } else {
                // Salon View - Show consolidated info

                // 1. Show Personal Leaves for ALL workers as badges
                if (currentLeaves && currentLeaves.length > 0 && showLeaves) {
                    const personalLeaves = currentLeaves.filter(l => l.admin_id !== null);
                    const leavesToday = personalLeaves.filter(l => {
                        const start = new Date(l.start_date); start.setHours(0, 0, 0, 0);
                        const end = new Date(l.end_date); end.setHours(23, 59, 59, 999);
                        return dayDate >= start && dayDate <= end;
                    });

                    leavesToday.forEach(l => {
                        const worker = currentWorkers ? currentWorkers.find(w => w.id == l.admin_id) : null;
                        const name = worker ? worker.name : 'Inconnu';
                        html += `<span class="appt-badge" style="background:#fff3e0; color:#e65100; border:1px solid #ffcc80; display:block; margin-top:2px;">Congés: ${name}</span>`;
                    });
                }

                // 2. Show Weekly Days Off for ALL workers
                if (currentWorkers && showWeeklyOff) {
                    currentWorkers.forEach(w => {
                        const daysOff = w.daysOff || [];
                        if (Array.isArray(daysOff) && daysOff.includes(dayOfWeekIndex)) {
                            // Check if already on leave (priority to leave badge) - actually showing both is fine or we filter
                            // Let's Check if this worker is already in leavesToday list?
                            const isOnLeave = currentLeaves && currentLeaves.some(l => {
                                if (l.admin_id != w.id) return false;
                                const start = new Date(l.start_date); start.setHours(0, 0, 0, 0);
                                const end = new Date(l.end_date); end.setHours(23, 59, 59, 999);
                                return dayDate >= start && dayDate <= end;
                            });

                            if (!isOnLeave) {
                                html += `<span class="appt-badge" style="background:#2196f3; color:white; display:block; margin-top:2px;">Repos: ${w.name}</span>`;
                            }
                        }
                    });
                }

                // 3. Show Appointments Count per Worker (Grouped)
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
                            const worker = currentWorkers ? currentWorkers.find(w => w.id == adminId) : null;
                            name = worker ? worker.name : 'Inconnu';
                        }
                        html += `<span class="appt-badge has-appt" style="display:block; margin-top:2px;">${name}<span class="text-desktop"> : </span><span class="mobile-break"></span>${count}</span>`;
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

async function openDayDetails(dateStr, appointments, shouldScroll = true) {
    currentDetailDate = dateStr;
    document.getElementById('details-date-label').textContent = `Détails du ${formatDateDisplay(dateStr)}`;
    const listContainer = document.getElementById('day-appointments-list');

    // Fetch Waitlist Counts
    let wlCounts = [];
    try {
        const res = await fetch(`${API_URL}/waiting-list/counts?date=${dateStr}`, { headers: getHeaders() });
        if (res.ok) wlCounts = await res.json();
    } catch (e) { console.error("WL Count error", e); }

    const getWlCount = (workerId) => {
        // defined workerId or null for 'any'
        // DB returns { desired_worker_id: X, count: N }
        // desired_worker_id might be null in DB for 'any'
        const entry = wlCounts.find(c => c.desired_worker_id == workerId); // loose match for null/undefined
        return entry ? entry.count : 0;
    };

    if ((!appointments || appointments.length === 0) && wlCounts.length === 0) {
        listContainer.innerHTML = '<p>Aucun rendez-vous ni liste d\'attente ce jour-là.</p>';
    } else {
        // Sort appointments
        const safeAppts = appointments || [];
        safeAppts.sort((a, b) => a.time.localeCompare(b.time));

        listContainer.innerHTML = ''; // Clear

        const filterEl = document.getElementById('admin-filter');
        const isSalonView = (!filterEl || filterEl.value === "");

        if (isSalonView) {
            // Group by Worker
            const groups = {};
            safeAppts.forEach(apt => {
                const wId = apt.admin_id || 'unassigned';
                if (!groups[wId]) groups[wId] = [];
                groups[wId].push(apt);
            });

            // Ensure we also show workers with 0 appointments but HAVE waitlist
            // Iterate all active workers + unassigned
            const allWorkerIds = new Set(Object.keys(groups));
            wlCounts.forEach(c => {
                if (c.desired_worker_id) allWorkerIds.add(String(c.desired_worker_id));
                // if null, mapped to 'unassigned' logic below? 
                // DB returns null for unassigned.
            });
            // Handle unassigned/any separately?
            // Let's iterate currentWorkers and add 'unassigned'

            // Build a consistent list of sections to render
            // 1. Real Workers
            currentWorkers.forEach(w => {
                const wId = String(w.id);
                const appts = groups[wId] || [];
                const waitingCount = getWlCount(w.id);

                if (appts.length > 0 || waitingCount > 0) {
                    renderWorkerSection(w.name, appts, waitingCount);
                }
            });

            // 2. Unassigned / Others (from groups or waitlist with null worker)
            const unassignedAppts = groups['unassigned'] || [];
            const unassignedWait = getWlCount(null); // or 'null' string? Check logic. likely null.

            if (unassignedAppts.length > 0 || unassignedWait > 0) {
                renderWorkerSection("Non assigné / Autre", unassignedAppts, unassignedWait);
            }

            if (listContainer.children.length === 0) {
                listContainer.innerHTML = '<p>Aucun rendez-vous sur cette journée.</p>';
            }

        } else {
            // Single Worker View
            const wId = filterEl.value;
            const waitingCount = getWlCount(wId);

            // Show subtitle with waiting count (restored)
            if (waitingCount > 0) {
                const notice = document.createElement('div');
                notice.className = 'alert alert-info';
                notice.style.marginBottom = '10px';
                notice.style.backgroundColor = '#e1f5fe';
                notice.style.color = '#0277bd';
                notice.style.padding = '10px';
                notice.style.borderRadius = '4px';
                notice.innerHTML = `<strong>File d'attente :</strong> ${waitingCount} personne(s) en attente pour ce jour.`;
                listContainer.appendChild(notice);
            }

            // Render Appointments
            listContainer.innerHTML += renderAppointmentTable(safeAppts, false);
        }

        // Initial Waitlist Fetch & Auto-Refresh Setup
        // Actually, since we now create HOLD appointments, we just need to refresh appointments!
        // The separate "Waiting List" fetch is only needed if we want to show badges for "Pending" requests.
        // But the user specifically complained about "OFFER SENT" visibility.
        // If we keep the badges, that's fine.
        // But we should NOT call updateWaitlistUI's table rendering part.

        try {
            const performRefresh = async () => {
                // We mainly need to refresh appointments to see the new HOLD ones.
                // But openDayDetails doesn't strictly re-fetch appointments in this loop structure easily *without* reloading the whole calendar.
                // Actually, 'loadAppointments()' refreshes the global cache, but does it update the open view?

                // Let's modify this to Reload Appointments + Update UI.
                await loadAppointments(); // Refreshes global 'appointmentsCache'

                // Then re-render the table with new data from cache
                const freshAppts = appointmentsCache.filter(a => a.date === dateStr);
                const safeFreshAppts = freshAppts.filter(a => a.admin_id !== null && a.admin_id !== undefined); // Simplified filter

                // Update Badge Counts (Waitlist Counts still relevant for PENDING)
                try {
                    const resCounts = await fetch(`${API_URL}/waiting-list/counts?date=${dateStr}`, { headers: getHeaders() });
                    if (resCounts.ok) {
                        const counts = await resCounts.json();
                        // Update Badges Only
                        updateWaitlistBadges(counts);
                    }
                } catch (e) { }

                // Re-render Appointment Table
                const listContainer = document.getElementById('day-appointments-list');
                if (listContainer) {
                    // Update Single Worker View
                    const filterEl = document.getElementById('admin-filter');
                    if (filterEl && filterEl.value) {
                        const wId = filterEl.value;
                        const filteredAppts = safeFreshAppts.filter(a => a.admin_id == wId);
                        // Find the table and replace body? Or simplify: just innerHTML the table part.
                        // This is tricky without destroying headers/alerts.
                        // Let's just re-run renderAppointmentTable and replace the table element.

                        const oldTable = listContainer.querySelector('.day-details-table');
                        if (oldTable) oldTable.remove();

                        // Append new table (or Place it)
                        const newTableHtml = renderAppointmentTable(filteredAppts, false);
                        listContainer.insertAdjacentHTML('beforeend', newTableHtml);
                    }
                }
            };

            // Run immediately
            // await performRefresh(); 
            // Actually, initial load is already done via arguments.

            // Setup Polling
            if (window.detailsInterval) clearInterval(window.detailsInterval);
            window.detailsInterval = setInterval(performRefresh, 10000);

        } catch (e) { console.error("WL Init error", e); }
    } // End of if (appointments) check

    dayDetailsSection.style.display = 'block';

    if (shouldScroll) {
        dayDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Helper to update Waitlist UI (Moved out of block scope if possible, but keeps closures if needed. 
// Actually updateWaitlistUI needs access to 'listContainer' etc.
// Let's pass 'listContainer' and 'currentWorkers' to it if we move it out. 
// For now, I'll define it HERE to keep it working with closure vars, but cleanly.

// NEW: Render Worker Section (was missing)
function renderWorkerSection(workerName, appts, waitCount) {
    const listContainer = document.getElementById('day-appointments-list');
    if (!listContainer) return;

    const section = document.createElement('div');
    section.style.marginBottom = '30px';

    // Header
    const header = document.createElement('h3');
    header.textContent = workerName;
    header.style.borderBottom = '1px solid #ddd';
    header.style.paddingBottom = '5px';
    header.style.marginBottom = '15px';
    section.appendChild(header);

    // Waitlist Alert
    if (waitCount > 0) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-info';
        alert.style.marginBottom = '10px';
        alert.style.backgroundColor = '#e1f5fe';
        alert.style.color = '#0277bd';
        alert.innerHTML = `<strong>File d'attente :</strong> ${waitCount} personne(s).`;
        section.appendChild(alert);
    }

    // Table or Empty msg
    if (appts && appts.length > 0) {
        section.innerHTML += renderAppointmentTable(appts, false);
    } else {
        section.innerHTML += '<p style="color:#777; font-style:italic;">Aucun rendez-vous planifié.</p>';
    }

    listContainer.appendChild(section);
}

// Simplified Badge Updater
function updateWaitlistBadges(counts) {
    const listContainer = document.getElementById('day-appointments-list');
    if (!listContainer) return;

    const getCount = (wid) => {
        const entry = counts.find(c => c.desired_worker_id == wid);
        return entry ? entry.count : 0;
    };

    // Update Single Worker View Alert
    const alertInfo = listContainer.querySelector('.alert-info');
    if (alertInfo) {
        const filterEl = document.getElementById('admin-filter');
        const wId = filterEl.value;
        const count = getCount(wId);
        if (count > 0) {
            alertInfo.innerHTML = `<strong>File d'attente :</strong> ${count} personne(s) en attente pour ce jour.`;
        } else {
            alertInfo.remove();
        }
    }
}

// Helper to render table (Moved to top level)
function renderAppointmentTable(apts, showWorkerCol) {
    if (!apts || apts.length === 0) return '<p style="color:#777; font-style:italic;">Aucun rendez-vous planifié.</p>';

    return `
        <table class="day-details-table">
            <thead>
                <tr>
                    <th style="width: 10%;">Heure</th>
                    <th style="${showWorkerCol ? 'width: 25%;' : 'width: 30%;'}">Service</th>
                    <th style="${showWorkerCol ? 'width: 20%;' : 'width: 25%;'}">Client</th>
                    ${showWorkerCol ? '<th style="width: 15%;">Coiffeur</th>' : ''}
                    <th style="${showWorkerCol ? 'width: 15%;' : 'width: 20%;'}">Tél</th>
                    <th style="width: 15%;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${apts.map(apt => {
        let workerName = "Autre";
        if (apt.admin_id) {
            const w = currentWorkers.find(worker => worker.id == apt.admin_id);
            if (w) workerName = w.name;
        }

        let serviceDisplay = apt.service;
        if (window.currentServices) {
            const svcObj = window.currentServices.find(s => s.id === apt.service);
            if (svcObj) {
                serviceDisplay = `${svcObj.name} (${svcObj.duration || 30} min)`;
            } else {
                const svcByName = window.currentServices.find(s => s.name === apt.service);
                if (svcByName) {
                    serviceDisplay = `${svcByName.name} (${svcByName.duration || 30} min)`;
                }
            }
        }

        let rowStyle = '';
        let statusBadge = '';

        if (apt.status === 'HOLD') {
            rowStyle = 'background-color: #fff3e0;';
            statusBadge = '<span class="appt-badge" style="background:#ff9800; color:white">En attente</span>';
        }

        return `
                    <tr style="${rowStyle}">
                        <td>${apt.time}</td>
                         <td>${serviceDisplay}</td>
                        <td>${apt.name} ${statusBadge}</td>
                        ${showWorkerCol ? `<td><span class="appt-badge">${workerName}</span></td>` : ''}
                        <td>${formatPhoneNumberDisplay(apt.phone)}</td>
                        <td>
                            ${renderActionButtons(
            `openEdit(${apt.id}, '${apt.name.replace("'", "\\'")}', '${apt.date}', '${apt.time}')`,
            `deleteApt(${apt.id}, '${apt.name.replace("'", "\\'")}', '${apt.date}', '${apt.time}', '${serviceDisplay.replace("'", "\\'")}', '${apt.email || ''}', '${(apt.phone || '').replace("'", "\\'")}')`,
            {
                editLabel: `<svg xmlns="http://www.w3.org/2000/svg" style="width:1.25rem; height:1.25rem;" viewBox="0 -960 960 960" fill="#000000"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`
            }
        )}
                        </td>
                    </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

function renderWaitlistTable(requests, container) {
    if (!requests || requests.length === 0) return;

    let html = `
    <table class="waitlist-table" style="width:100%; background:#fff8e1; border:1px solid #ffe0b2; margin-bottom:10px;">
        <thead style="background:#ffecb3;">
            <tr>
                <th style="padding:8px;">Créé le</th>
                <th style="padding:8px;">Client</th>
                <th style="padding:8px;">Préférence</th>
                <th style="padding:8px;">Statut</th>
                <th style="padding:8px;">Action</th>
            </tr>
        </thead>
        <tbody>
    `;

    requests.forEach(req => {
        const createdDate = new Date(req.created_at);
        const timeStr = createdDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        let statusBadge = '<span class="appt-badge" style="background:#ff9800; color:white">En attente</span>';
        if (req.status === 'OFFER_SENT') {
            statusBadge = '<span class="appt-badge" style="background:#4caf50; color:white">Offre envoyée ⏳</span>';
        }

        // Determine Time Preference Display
        let prefDisplay = '-';
        if (req.start_time && req.end_time) {
            prefDisplay = `${req.start_time} - ${req.end_time}`;
        }

        html += `
            <tr style="border-bottom:1px solid #ffe0b2;">
                <td style="padding:8px;">${timeStr}</td>
                <td style="padding:8px;">${req.client_name}<br><small>${req.client_phone || ''}</small></td>
                <td style="padding:8px;">${prefDisplay}</td>
                <td style="padding:8px;">${statusBadge}</td>
                <td style="padding:8px;">
                     <!-- Actions: Delete (Cancel request) -->
                    <button class="btn-x" onclick="deleteWaitRequest(${req.id})" title="Supprimer la demande">&times;</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// Global action for waitlist
// Global action for waitlist
window.deleteWaitRequest = async (id) => {
    if (!confirm("Supprimer cette demande de la file d'attente ?")) return;
    try {
        await fetch(`${API_URL}/waiting-list/requests/${id}`, { method: 'DELETE', headers: getHeaders() });

        // Refresh Current View without reload
        if (currentDetailDate) {
            // Re-open details (which triggers fetch)
            const dateStr = currentDetailDate;
            const appts = appointmentsCache.filter(a => a.date === dateStr);
            openDayDetails(dateStr, appts, false); // false = no scroll
        }
        loadAppointments(); // BG refresh
    } catch (e) { alert(e.message); }
};

export function closeDayDetails() {
    dayDetailsSection.style.display = 'none';
    currentDetailDate = null;
}

export async function deleteApt(id, name, date, time, service, email, phone) {
    const hasEmail = (email && email !== 'null' && email !== 'undefined' && email.trim() !== '');

    // Check Email Config first
    let emailConfigured = false;
    try {
        const sRes = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        const settings = await sRes.json();
        // Admin side gets full email_config object, check if host/user exist
        if (settings.email_config && settings.email_config.host && settings.email_config.user) {
            emailConfigured = true;
        }
    } catch (e) { console.warn("Settings check failed", e); }

    // 1. Detailed Confirmation (Matching settings.js style)
    let msg = `Êtes - vous sûr de vouloir supprimer le rendez - vous ?\n\n` +
        `- ${formatDateDisplay(date)} ${time} : ${name}(${phone || 'Sans tél'})`;

    if (hasEmail && emailConfigured) {
        msg += `\n\n(Une option pour envoyer un email d'annulation automatique vous sera proposée à l'étape suivante.)`;
    } else {
        if (!hasEmail) {
            msg += `\n\n⚠️ Ce client n'a pas d'adresse email enregistrée.Pensez à le prévenir par téléphone.`;
        } else {
            // Has email but NO config
            msg += `\n\n(L'envoi d'email est désactivé car le serveur SMTP n'est pas configuré.)`;
        }
    }

    if (!confirm(msg)) return;

    let sendEmail = false;

    // 2. Email Confirmation (only if email exists AND configured)
    if (hasEmail && emailConfigured) {
        if (confirm("Voulez-vous envoyer un email d'annulation au client concerné ?")) {
            sendEmail = true;
        }
    }

    try {
        await fetch(`${API_URL}/appointments/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
            body: JSON.stringify({ sendEmail }) // Pass flag
        });
        loadAppointments();
    } catch (e) {
        alert('Erreur: ' + e.message);
    }
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


function formatPhoneNumberDisplay(phone) {
    if (!phone) return '-';
    // Replace +33 with 0
    let cleanPhone = phone.replace(/^\+33/, '0');
    // Remove all non-digit characters to be safe (and spaces if any were already there)
    cleanPhone = cleanPhone.replace(/\D/g, '');
    // Format 2 by 2
    return cleanPhone.replace(/(\d{2})(?=\d)/g, '$1 ');
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
