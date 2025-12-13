// public/js/admin/settings.js
import { API_URL, getHeaders, formatDateDisplay } from './config.js';
import { renderServicesList, setServicesData } from './services.js';
import { renderProductsList } from './products.js';
import { loadAppointments } from './calendar.js';
import { setSchedule, setHolidayRanges, setHomeContent, setSalonClosingTime, currentHolidayRanges, currentHomeContent, setProducts } from './state.js';

let currentHolidays = [];
// Cache for leaves
let allLeaves = [];

export async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        const { openingHours, holidays, home_content, services, contact_info, products } = await res.json();

        // Update State (holidayRanges is legacy, we load leaves separately)
        setHomeContent(home_content || {});

        let schedule = [];
        if (Array.isArray(openingHours)) {
            schedule = openingHours;
        } else {
            // Migration from Old
            const start = openingHours?.start || '09:00';
            const end = openingHours?.end || '18:00';
            const closed = openingHours?.closedDays || [];

            for (let i = 0; i < 7; i++) {
                schedule[i] = {
                    open: start,
                    close: end,
                    isOpen: !closed.includes(i)
                };
            }
        }

        const todayIdx = new Date().getDay();
        setSalonClosingTime(schedule[todayIdx]?.close || '19:00');

        setSchedule(schedule);

        renderScheduleTable(schedule);

        // Load Leaves separate from settings now
        await loadLeaves();

        // Populate Content Tab
        setServicesData(services || []);
        renderServicesList();

        setProducts(products || []);
        renderProductsList();

        if (document.getElementById('content-title')) document.getElementById('content-title').value = currentHomeContent.title || '';
        if (document.getElementById('content-subtitle')) document.getElementById('content-subtitle').value = currentHomeContent.subtitle || '';
        if (document.getElementById('content-philosophy')) document.getElementById('content-philosophy').value = currentHomeContent.philosophy || '';
        if (document.getElementById('content-address')) document.getElementById('content-address').value = contact_info?.address || '';
        if (document.getElementById('content-phone')) document.getElementById('content-phone').value = contact_info?.phone || '';

        loadAppointments();
        initProfileForm(); // Initialize profile dynamic logic

    } catch (e) {
        console.error('Error loading settings', e);
    }
}

let isProfileInit = false;
function initProfileForm() {
    if (isProfileInit) return;
    isProfileInit = true;

    const filterEl = document.getElementById('admin-filter');
    const profileForm = document.getElementById('profile-form');
    const displayInput = document.getElementById('profile-displayname');
    const sectionTitle = document.querySelector('#profile-form').closest('.settings-section').querySelector('h3');

    // Update Profile View on Filter Change
    const updateProfileView = async () => {
        const adminId = filterEl.value;
        const adminName = filterEl.options[filterEl.selectedIndex]?.text || 'Salon';

        // Clear sensitive fields
        document.getElementById('profile-new-pass').value = '';

        // Pre-fill with known name from dropdown (better UX than loading)
        displayInput.value = adminName;

        if (adminId) {
            // Editing specific worker
            sectionTitle.textContent = `Profil de ${adminName}`;

            // Fetch worker details to ensure we have the latest display name
            try {
                const res = await fetch(`${API_URL}/workers`, { headers: getHeaders() });
                const workers = await res.json();
                const worker = workers.find(w => w.id == adminId);
                if (worker) {
                    displayInput.value = worker.display_name || worker.username;
                }
            } catch (e) {
                console.error('Failed to load worker details', e);
            }

        } else {
            // Editing Self (Salon/Logged-in User)
            sectionTitle.textContent = 'Mon Profil';

            // Fetch own details
            try {
                const res = await fetch(`${API_URL}/me`, { headers: getHeaders() });
                const me = await res.json();
                displayInput.value = me.displayName;
            } catch (e) {
                console.log(e);
            }
        }
    };

    // Attach listener to filter
    if (filterEl) {
        filterEl.addEventListener('change', updateProfileView);
    }

    // Initial call
    updateProfileView();

    // Handle Submit
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminId = filterEl.value;
        const displayname = displayInput.value;
        const newpass = document.getElementById('profile-new-pass').value;

        try {
            let res;
            if (adminId) {
                // Update Worker
                res = await fetch(`${API_URL}/workers/${adminId}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ displayName: displayname, password: newpass })
                });
            } else {
                // Update Self
                res = await fetch(`${API_URL}/me`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    // Old password no longer required
                    body: JSON.stringify({ displayName: displayname, newPassword: newpass })
                });
            }

            if (res.ok) {
                alert('Profil mis à jour');
                document.getElementById('profile-new-pass').value = '';
                // Reload dashboard title if we changed name
                if (!adminId) {
                    // If we updated ourselves, reload common elements or just let polling handle it?
                    // Reloading settings fetches /me used by other things maybe.
                }
            } else {
                const err = await res.json();
                alert('Erreur: ' + (err.error || 'Erreur inconnue'));
            }
        } catch (err) {
            console.error(err);
            alert('Erreur réseau');
        }
    });

}

// --- Leaves Management ---

export async function loadLeaves() {
    try {
        const res = await fetch(`${API_URL}/leaves`, { headers: getHeaders() });
        allLeaves = await res.json();

        // Dynamic import to avoid cycles or ensure loading
        const State = await import('./state.js');
        State.setLeaves(allLeaves);

        renderHolidayList();
    } catch (e) {
        console.error("Failed to load leaves", e);
    }
}

function renderHolidayList() {
    const list = document.getElementById('holiday-list');
    const filterEl = document.getElementById('admin-filter');
    const selectedAdminId = filterEl ? filterEl.value : "";
    const selectedAdminName = filterEl && filterEl.options[filterEl.selectedIndex] ? filterEl.options[filterEl.selectedIndex].text : "Salon";

    // Update Section Title
    const sectionTitle = document.querySelector('#leaves-section-title');
    if (sectionTitle) {
        if (selectedAdminId === "") {
            sectionTitle.textContent = "Période de fermeture du salon (Global)";
        } else {
            sectionTitle.textContent = `Période de congés de ${selectedAdminName}`;
        }
    }

    list.innerHTML = '';

    // Filter leaves based on context
    // If Global selected (""), show Global leaves (admin_id is null)
    // If User selected, show User leaves (admin_id = selected)
    const filteredLeaves = allLeaves.filter(l => {
        if (selectedAdminId === "") return l.admin_id === null;
        return l.admin_id == selectedAdminId;
    });

    if (filteredLeaves.length === 0) {
        list.innerHTML = '<p style="color:#666; font-style:italic;">Aucune période configurée pour cette sélection.</p>';
        return;
    }

    filteredLeaves.forEach((leave) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#f4f4f4; padding:10px; margin-bottom:5px; border-radius:4px;';

        const noteDisplay = (leave.note && leave.note !== 'Legacy Migration') ? ` <small>(${leave.note})</small>` : '';

        item.innerHTML = `
            <span><strong>${formatDateDisplay(leave.start_date)}</strong> au <strong>${formatDateDisplay(leave.end_date)}</strong>${noteDisplay}</span>
            <button onclick="removeHolidayRange(${leave.id})" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold;">Supprimer</button>
        `;
        list.appendChild(item);
    });
}

// Listen to filter change
const filterEl = document.getElementById('admin-filter');
if (filterEl) {
    filterEl.addEventListener('change', () => {
        renderHolidayList(); // Re-render with new filter (data is already loaded or we should reload?)
        // Better to reload to be sure we have latest if polling updates? 
        // Polling updates settings, which calls loadSettings -> loadLeaves. 
        // But manual change should just filter existing or reload?
        // Let's just render.
    });
}


export async function addHolidayRange() {
    const start = document.getElementById('holiday-start').value;
    const end = document.getElementById('holiday-end').value;
    const filterEl = document.getElementById('admin-filter');
    const adminId = filterEl ? filterEl.value : ""; // "" or ID

    if (!start || !end) return alert('Dates incomplètes');
    if (start > end) return alert('La date de début doit être avant la fin');

    try {
        await fetch(`${API_URL}/leaves`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                start,
                end,
                adminId: adminId, // Controller handles "" as null
                note: adminId ? 'Congés Coiffeur' : 'Fermeture'
            })
        });

        // Reload
        await loadLeaves();
        // Clear inputs
        document.getElementById('holiday-start').value = '';
        document.getElementById('holiday-end').value = '';

        // Also reload calendar/appts as availability changed
        loadAppointments();

    } catch (e) {
        alert('Erreur lors de l\'ajout');
        console.error(e);
    }
}

export async function removeHolidayRange(id) {
    if (!confirm('Supprimer cette période ?')) return;
    try {
        await fetch(`${API_URL}/leaves/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await loadLeaves();
        loadAppointments();
    } catch (e) {
        alert('Erreur lors de la suppression');
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

// Global exposure
window.toggleRow = toggleRow;
window.copyMondayToAll = copyMondayToAll;
window.addHolidayRange = addHolidayRange;
window.removeHolidayRange = removeHolidayRange;
window.saveSchedule = saveSchedule;

