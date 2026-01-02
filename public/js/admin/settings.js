// public/js/admin/settings.js
import { API_URL, getHeaders, formatDateDisplay } from './config.js';
import { renderServicesList, setServicesData } from './services.js';
import { renderProductsList } from './products.js';
import { loadAppointments, loadWorkersForFilter } from './calendar.js';
import { setSchedule, setHolidayRanges, setHomeContent, setSalonClosingTime, currentHolidayRanges, currentHomeContent, setProducts } from './state.js';
import { renderActionButtons } from './ui-components.js';

let currentHolidays = [];
// Cache for leaves
let allLeaves = [];

export async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        const { openingHours, holidays, home_content, services, contact_info, products, email_config } = await res.json();

        // Populate Email Config
        // Populate Email Config
        if (email_config) {
            document.getElementById('email-config-user').value = email_config.user || '';
            document.getElementById('email-config-pass').value = email_config.pass || '';
            document.getElementById('email-config-host').value = email_config.host || '';
            document.getElementById('email-config-port').value = email_config.port || '';
        }

        // Auto-Discovery Logic
        const emailInput = document.getElementById('email-config-user');
        if (emailInput) {
            emailInput.addEventListener('change', () => {
                const email = emailInput.value.toLowerCase();
                const hostInput = document.getElementById('email-config-host');
                const portInput = document.getElementById('email-config-port');

                // Only auto-fill if host is empty to avoid overwriting manual config
                if (hostInput.value) return;

                const providers = {
                    'gmail.com': { host: 'smtp.gmail.com', port: 465 },
                    'orange.fr': { host: 'smtp.orange.fr', port: 465 },
                    'wanadoo.fr': { host: 'smtp.orange.fr', port: 465 },
                    'yahoo.fr': { host: 'smtp.mail.yahoo.com', port: 465 },
                    'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 465 },
                    'outlook.com': { host: 'smtp.office365.com', port: 587 },
                    'hotmail.com': { host: 'smtp.office365.com', port: 587 },
                    'live.com': { host: 'smtp.office365.com', port: 587 },
                    'sfr.fr': { host: 'smtp.sfr.fr', port: 465 },
                    'neuf.fr': { host: 'smtp.sfr.fr', port: 465 },
                    'free.fr': { host: 'smtp.free.fr', port: 465 },
                    'laposte.net': { host: 'smtp.laposte.net', port: 465 },
                    'icloud.com': { host: 'smtp.mail.me.com', port: 587 },
                    'me.com': { host: 'smtp.mail.me.com', port: 587 }
                };

                for (const [domain, config] of Object.entries(providers)) {
                    if (email.includes('@' + domain)) {
                        hostInput.value = config.host;
                        portInput.value = config.port;
                        // Visual cue?
                        break;
                    }
                }
            });
        }

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

        // Explicitly update Profile Title if filter is selected (to handle renames)
        const filterEl = document.getElementById('admin-filter');
        if (filterEl) {
            const selectedText = filterEl.options[filterEl.selectedIndex]?.text || 'Salon';
            const profileTitle = document.querySelector('#profile-form')?.closest('.settings-section')?.querySelector('h3');
            if (profileTitle) {
                if (filterEl.value) {
                    profileTitle.textContent = `Profil de ${selectedText}`;
                } else {
                    profileTitle.textContent = 'Profil du Salon';
                }
            }
        }

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
            displayInput.disabled = false; // Allow editing workers

            // Fetch worker details to ensure we have the latest display name
            try {
                const res = await fetch(`${API_URL}/workers`, { headers: getHeaders() });
                const workers = await res.json();
                const worker = workers.find(w => w.id == adminId);
                if (worker) {
                    displayInput.value = worker.displayName || worker.username;

                    // Update Days Off Checkboxes
                    const daysOff = worker.daysOff || []; // API returns [0,1,...]
                    const container = document.getElementById('days-off-container');
                    if (container) {
                        const boxes = container.querySelectorAll('input[type="checkbox"]');
                        boxes.forEach(box => {
                            box.checked = daysOff.includes(parseInt(box.value));
                        });
                        container.style.display = 'block';
                    }
                }
            } catch (e) {
                console.error('Failed to load worker details', e);
            }

        } else {
            // Editing Self (Salon/Logged-in User)
            sectionTitle.textContent = 'Profil du Salon';
            displayInput.value = 'Salon';
            displayInput.disabled = true; // Enforce "Salon" cannot be changed

            // Hide Days Off for Salon (implies open every day per schedule)
            const container = document.getElementById('days-off-container');
            if (container) container.style.display = 'none';

            // We do not fetch /me name here to avoid overwriting "Salon" with "Roger".
            // The user wants "Salon" to be displayed automatically.
        }
    };

    // Inject Days Off UI
    const passInput = document.getElementById('profile-new-pass');
    if (passInput) {
        const wrapper = document.createElement('div');
        wrapper.id = 'days-off-container';
        wrapper.style.marginTop = '15px';
        wrapper.style.display = 'none'; // Hidden by default (until worker selected)

        wrapper.innerHTML = `
            <label style="display:block; margin-bottom:5px;">Jours de repos hebdomadaires :</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, index) => {
            // Map visual index (0=Lun) to DB index (1=Lun ... 6=Sam, 0=Dim)
            // Visual: 0(Lun), 1(Mar), 2(Mer), 3(Jeu), 4(Ven), 5(Sam), 6(Dim)
            // DB:     1,      2,      3,      4,      5,      6,      0
            let dbValue = index + 1;
            if (dbValue === 7) dbValue = 0; // Sunday

            return `
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" value="${dbValue}" name="daysOff">
                        ${d}
                    </label>
                `}).join('')}
            </div>
        `;
        // Insert after password input parent (usually a div)
        passInput.closest('div').after(wrapper);
    }

    // Attach listener to filter
    if (filterEl) {
        filterEl.addEventListener('change', updateProfileView);
    }

    // Initial call
    updateProfileView();

    // ----------------------------------------------------
    // START: Delete Worker Button Logic
    // ----------------------------------------------------
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn'; // removed btn-danger to avoid BS conflict if any, custom style below
    deleteBtn.style.backgroundColor = '#d32f2f'; // Red
    deleteBtn.style.color = '#ffffff';
    deleteBtn.style.border = 'none';
    deleteBtn.style.padding = '10px 20px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.marginTop = '0px'; // Align with submit
    deleteBtn.textContent = 'Supprimer ce profil';
    deleteBtn.style.display = 'none';

    // Ensure it sits next to Update
    // Ensure it sits next to Update
    deleteBtn.style.verticalAlign = 'middle';
    deleteBtn.style.width = 'auto'; // Force auto width "taille normale"

    // Insert logic: Wrap in .form-actions if not already
    const submitBtn = profileForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        let container = submitBtn.parentNode;

        // Check if already in a wrapper
        if (!container.classList.contains('form-actions')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-actions';
            // Insert wrapper before button
            container.insertBefore(wrapper, submitBtn);
            // Move button into wrapper
            wrapper.appendChild(submitBtn);
            container = wrapper;
        }

        // Append delete button next to submit button
        container.appendChild(deleteBtn);
    }

    deleteBtn.onclick = async (e) => {
        e.preventDefault();
        const adminId = filterEl.value;
        if (!adminId) return; // Should not happen if button is shown

        if (!confirm('Attention: La suppression est définitive.\n\nTous les rendez-vous et congés associés à ce coiffeur seront également supprimés.\n\nContinuer ?')) {
            return;
        }

        try {
            const res = await fetch(`${API_URL}/workers/${adminId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (res.ok) {
                alert('Profil supprimé avec succès.');

                // 1. Immediate Visual Reset
                filterEl.value = "";
                filterEl.innerHTML = '<option value="">Salon</option>';

                const displayInput = document.getElementById('profile-displayname');
                if (displayInput) {
                    displayInput.value = 'Salon';
                    displayInput.disabled = true;
                }
                const sectionTitle = document.querySelector('#profile-form')?.closest('.settings-section')?.querySelector('h3');
                if (sectionTitle) sectionTitle.textContent = 'Profil du Salon';
                document.getElementById('profile-new-pass').value = '';
                deleteBtn.style.display = 'none';

                // 2. Refresh Data (Async)
                await loadWorkersForFilter();

                // Ensure value is still empty after reload
                filterEl.value = "";

                loadAppointments();

                // REMOVED: dispatchEvent(change) to avoid race conditions.

            } else {
                const err = await res.json();
                alert('Erreur: ' + (err.error || 'Impossible de supprimer'));
            }
        } catch (error) {
            console.error(error);
            alert('Erreur réseau');
        }
    };

    // Update visibility in updateProfileView wrapper
    const originalUpdateView = updateProfileView;
    const wrappedUpdateView = async () => {
        await originalUpdateView();
        const adminId = filterEl.value;
        if (adminId) {
            deleteBtn.style.display = 'inline-block';
        } else {
            deleteBtn.style.display = 'none';
        }
    };

    // Override the listener
    filterEl.removeEventListener('change', updateProfileView);
    filterEl.addEventListener('change', wrappedUpdateView);

    // Call immediately
    wrappedUpdateView();
    // ----------------------------------------------------
    // END: Delete Worker Button Logic
    // ----------------------------------------------------

    // Handle Submit
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminId = filterEl.value;
        const displayname = displayInput.value;
        const newpass = document.getElementById('profile-new-pass').value;

        try {
            let res;
            if (adminId) {
                // Collect Days Off
                const daysOff = [];
                const container = document.getElementById('days-off-container');
                if (container) {
                    container.querySelectorAll('input[name="daysOff"]:checked').forEach(cb => {
                        daysOff.push(parseInt(cb.value));
                    });
                }

                // Check for Days Off Conflicts if adminId exists (Update)
                if (adminId) {
                    const checkRes = await fetch(`${API_URL}/workers/check-days-off`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ adminId, daysOff })
                    });
                    const conflicts = await checkRes.json();

                    if (conflicts.length > 0) {
                        const msg = `Attention: ${conflicts.length} rendez-vous existent sur ces nouveaux jours de repos :\n\n` +
                            conflicts.map(c => `- ${formatDateDisplay(c.date)} ${c.time} : ${c.name} (${c.phone || 'Sans tél'})`).join('\n') +
                            `\n\nVoulez-vous quand même appliquer ces jours de repos ? (Pensez à prévenir les clients)`;

                        if (!confirm(msg)) {
                            return; // Abort
                        }
                    }
                }


                // Update Worker
                res = await fetch(`${API_URL}/workers/${adminId}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ displayName: displayname, password: newpass, daysOff: daysOff })
                });
            } else {
                // Update Self
                // Self-update of daysOff not implemented/exposed for Salon "me"
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

                // Reload Admin Filter to update cache (Worker Names, Days Off)
                await loadWorkersForFilter();

                // If we edited a specific worker, re-select them in the filter to keep context
                if (adminId) {
                    filterEl.value = adminId;
                } else {
                    // If we updated ourselves (Salon), might be "Salon" or actual user ID if implemented differently.
                    // Assuming "Salon" is empty string value
                    // filterEl.value = ""; 
                }

                // Refresh title
                loadAppointments();

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
            ${renderActionButtons(null, `removeHolidayRange(${leave.id})`)}
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
        // Check for conflicts first
        const checkRes = await fetch(`${API_URL}/leaves/check?start=${start}&end=${end}&adminId=${adminId}`, {
            headers: getHeaders()
        });
        const conflicts = await checkRes.json();

        if (conflicts.length > 0) {
            const msg = `Attention: ${conflicts.length} rendez-vous existent pendant cette période :\n\n` +
                conflicts.map(c => `- ${formatDateDisplay(c.date)} ${c.time} : [${c.worker_name || c.worker_username || 'Salon'}] ${c.name} (${c.phone || 'Sans tél'})`).join('\n') +
                `\n\nVoulez-vous quand même créer cette période d'absence ? (Pensez à prévenir les clients)`;

            if (!confirm(msg)) {
                return; // Abort
            }
        }

        const res = await fetch(`${API_URL}/leaves`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                start,
                end,
                adminId: adminId, // Controller handles "" as null
                note: adminId ? 'Congés Coiffeur' : 'Fermeture'
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erreur lors de la sauvegarde');
        }

        // Success Feedback
        alert('Congés ajoutés avec succès');

        // Reload
        await loadLeaves();
        // Clear inputs
        document.getElementById('holiday-start').value = '';
        document.getElementById('holiday-end').value = '';

        // Also reload calendar/appts as availability changed
        loadAppointments();

    } catch (e) {
        console.error(e);
        // Show specific error if available
        alert('Erreur: ' + (e.message || 'Erreur lors de l\'ajout'));
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
            <td><input type="time" class="sched-break-start" value="${dayData.breakStart || ''}" ${!dayData.isOpen ? 'disabled' : ''}></td>
            <td><input type="time" class="sched-break-end" value="${dayData.breakEnd || ''}" ${!dayData.isOpen ? 'disabled' : ''}></td>
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
        tr.querySelector('.sched-break-start').value = monRow.querySelector('.sched-break-start').value;
        tr.querySelector('.sched-break-end').value = monRow.querySelector('.sched-break-end').value;
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
        const breakStart = tr.querySelector('.sched-break-start').value;
        const breakEnd = tr.querySelector('.sched-break-end').value;
        schedule[idx] = { isOpen, open, close, breakStart, breakEnd };
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

export async function saveEmailConfig() {
    const user = document.getElementById('email-config-user').value;
    const pass = document.getElementById('email-config-pass').value;
    const host = document.getElementById('email-config-host').value;
    const port = document.getElementById('email-config-port').value;

    const config = (user && pass) ? { user, pass, host, port } : null;

    try {
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email_config: config })
        });
        alert('Configuration Email enregistrée !');
    } catch (e) {
        alert('Erreur lors de la sauvegarde');
    }
}
window.saveEmailConfig = saveEmailConfig;

export async function testEmailConfig() {
    const user = document.getElementById('email-config-user').value;
    const pass = document.getElementById('email-config-pass').value;
    const host = document.getElementById('email-config-host').value;
    const port = document.getElementById('email-config-port').value;

    if (!user || !pass) {
        alert('Veuillez entrer une adresse et un mot de passe.');
        return;
    }

    const btn = document.querySelector('button[onclick="testEmailConfig()"]');
    const originalText = btn ? btn.innerText : 'Tester';
    if (btn) btn.innerText = 'Test en cours...';

    try {
        const res = await fetch(`${API_URL}/settings/email-test`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ user, pass, host, port })
        });

        if (res.ok) {
            alert('Connexion réussie ! Un email de test a été envoyé.');
        } else {
            if (res.status === 404) {
                alert('Erreur: Le service de test est introuvable.\n\nAvez-vous redémarré le serveur (npm start) après la mise à jour ?');
                return;
            }
            let errorMsg = 'Erreur inconnue';
            try {
                const err = await res.json();
                errorMsg = err.error || errorMsg;
            } catch (jsonErr) {
                errorMsg = 'Réponse serveur invalide (Non-JSON)';
            }
            alert('Échec de la connexion : ' + errorMsg);
        }
    } catch (e) {
        console.error(e);
        alert('Erreur réseau lors du test (Le serveur est-il lancé ?).');
    } finally {
        if (btn) btn.innerText = originalText;
    }
}
window.testEmailConfig = testEmailConfig;

