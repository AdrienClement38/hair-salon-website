import { API_URL, getHeaders, formatDateDisplay } from './config.js';
import { currentSchedule, currentLeaves, salonClosingTime } from './state.js';
import { renderActionButtons } from './ui-components.js';

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
            localStorage.setItem('adminFilter', e.target.value);
            loadAppointments();
        });
    }

    // Load services for ID lookup
    loadServicesForCalendar();
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
        const res = await fetch('/api/workers');
        const workers = await res.json();
        currentWorkers = workers;
        const select = document.getElementById('admin-filter');
        const currentValue = select.value;

        // Keep first option (All)
        select.innerHTML = '<option value="">Salon</option>';

        workers.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name;
            select.appendChild(opt);
        });

        if (currentValue) {
            select.value = currentValue;
        } else {
            const saved = localStorage.getItem('adminFilter');
            if (saved) {
                // Verify if option exists
                if (select.querySelector(`option[value="${saved}"]`)) {
                    select.value = saved;
                    // Trigger load because default load might have run with empty filter
                    loadAppointments();
                }
            }
        }
    } catch (e) {
        console.error('Failed to load workers', e);
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

function openDayDetails(dateStr, appointments, shouldScroll = true) {
    currentDetailDate = dateStr;
    document.getElementById('details-date-label').textContent = `Détails du ${formatDateDisplay(dateStr)}`;
    const listContainer = document.getElementById('day-appointments-list');

    if (!appointments || appointments.length === 0) {
        listContainer.innerHTML = '<p>Aucun rendez-vous ce jour-là.</p>';
    } else {
        appointments.sort((a, b) => a.time.localeCompare(b.time));

        listContainer.innerHTML = ''; // Clear

        const filterEl = document.getElementById('admin-filter');
        const isSalonView = (!filterEl || filterEl.value === "");

        if (isSalonView) {
            // Group by Worker
            const groups = {};
            appointments.forEach(apt => {
                const wId = apt.admin_id || 'unassigned';
                if (!groups[wId]) groups[wId] = [];
                groups[wId].push(apt);
            });

            // Iterating keys (Worker IDs)
            // Sort to have named workers first?
            for (const [wId, groupApts] of Object.entries(groups)) {
                let workerName = "Autre / Non assigné";
                if (wId !== 'unassigned') {
                    const w = currentWorkers.find(worker => worker.id == wId);
                    if (w) workerName = w.name;
                }

                // Create Section
                const section = document.createElement('div');
                section.className = 'worker-section';
                section.style.marginBottom = '20px';
                section.innerHTML = `<h2 style="font-size: 1.8rem; margin-bottom: 10px; color: #333;">${workerName}</h2>`;

                section.innerHTML += renderAppointmentTable(groupApts, false); // False = No Coiffeur column
                listContainer.appendChild(section);
            }

            if (appointments.length === 0) {
                listContainer.innerHTML = '<p>Aucun rendez-vous sur cette journée.</p>';
            }

        } else {
            // Single Worker View
            // Render one table, maybe still hide Coiffeur col as it's redundant?
            // User asked for specific table titles on Salon profile. 
            // For specific profile, standard table is fine, but maybe title is good too?
            // Let's keep one table.
            listContainer.innerHTML = renderAppointmentTable(appointments, false); // No need for col since we know who it is
        }
    }

    // Helper to render table
    function renderAppointmentTable(apts, showWorkerCol) {
        if (apts.length === 0) return '<p>Aucun rendez-vous.</p>';

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

            return `
                    <tr>
                        <td>${apt.time}</td>
                         <td>${serviceDisplay}</td>
                        <td>${apt.name}</td>
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

    dayDetailsSection.style.display = 'block';

    if (shouldScroll) {
        dayDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function closeDayDetails() {
    dayDetailsSection.style.display = 'none';
    currentDetailDate = null;
}

export async function deleteApt(id, name, date, time, service, email, phone) {
    const hasEmail = (email && email !== 'null' && email !== 'undefined' && email.trim() !== '');

    // 1. Detailed Confirmation (Matching settings.js style)
    // Structure:
    // "Êtes-vous sûr de vouloir supprimer le rendez-vous ?
    //
    // - [Date] [Heure] : [Nom] ([Phone])
    //
    // (Une option pour envoyer un email...)"

    let msg = `Êtes-vous sûr de vouloir supprimer le rendez-vous ?\n\n` +
        `- ${formatDateDisplay(date)} ${time} : ${name} (${phone || 'Sans tél'})`;

    if (hasEmail) {
        msg += `\n\n(Une option pour envoyer un email d'annulation automatique vous sera proposée à l'étape suivante.)`;
    } else {
        msg += `\n\n⚠️ Ce client n'a pas d'adresse email enregistrée. Pensez à le prévenir par téléphone.`;
    }

    if (!confirm(msg)) return;

    let sendEmail = false;

    // 2. Email Confirmation (only if email exists)
    if (hasEmail) {
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
