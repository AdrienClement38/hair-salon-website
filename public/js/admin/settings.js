// public/js/admin/settings.js
import { API_URL, getHeaders, formatDateDisplay } from './config.js';
import { renderServicesList, setServicesData } from './services.js';
import { renderProductsList } from './products.js';
import { loadAppointments, loadWorkersForFilter } from './calendar.js';
import { setSchedule, setHolidayRanges, setHomeContent, setSalonClosingTime, currentHolidayRanges, currentHomeContent, setProducts, setSalonIdentity } from './state.js';
import { renderActionButtons } from './ui-components.js';

let currentHolidays = [];
// Cache for leaves
let allLeaves = [];

export async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        const { openingHours, holidays, home_content, services, contact_info, products, email_config, salon_identity } = await res.json();

        // Populate Identity
        const identity = salon_identity || { name: 'La Base Coiffure', logo: null };
        setSalonIdentity(identity);
        if (document.getElementById('salon-name')) document.getElementById('salon-name').value = identity.name;

        // Identity Logic - Logo handling moved to content.js to unify image handling
        // We only handle visibility toggle based on data existence if needed, but content.js handles src.
        // Actually, content.js sets src regardless.
        // Let's just remove this block to avoid conflict.

        // Populate Email Config
        // Populate Email Config
        // Populate Email Config
        if (email_config) {
            if (document.getElementById('email-config-user')) document.getElementById('email-config-user').value = email_config.user || '';
            if (document.getElementById('email-config-pass')) document.getElementById('email-config-pass').value = email_config.pass || '';
            if (document.getElementById('email-config-host')) document.getElementById('email-config-host').value = email_config.host || '';
            if (document.getElementById('email-config-port')) document.getElementById('email-config-port').value = email_config.port || '';
        } else {
            // Explicitly clear fields if no config exists (handles case where fields were autofilled)
            if (document.getElementById('email-config-user')) document.getElementById('email-config-user').value = '';
            if (document.getElementById('email-config-pass')) document.getElementById('email-config-pass').value = '';
            if (document.getElementById('email-config-host')) document.getElementById('email-config-host').value = '';
            if (document.getElementById('email-config-port')) document.getElementById('email-config-port').value = '';
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

        // Dispatch event for other modules (content.js) to know settings are ready
        window.dispatchEvent(new Event('settings-loaded'));

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
        const usernameInput = document.getElementById('profile-username');
        // Parent section of the form
        const profileSection = profileForm.closest('.settings-section');

        // Clear sensitive fields
        document.getElementById('profile-new-pass').value = '';

        if (adminId) {
            // Editing specific worker
            if (profileSection) profileSection.style.display = 'block';

            sectionTitle.textContent = `Profil de ${adminName}`;
            displayInput.value = adminName;
            displayInput.disabled = false; // Allow editing workers
            if (usernameInput) usernameInput.disabled = false;

            // Fetch worker details to ensure we have the latest display name
            try {
                const res = await fetch(`${API_URL}/workers`, { headers: getHeaders() });
                const workers = await res.json();
                const worker = workers.find(w => w.id == adminId);
                if (worker) {
                    displayInput.value = worker.displayName || worker.username;
                    if (usernameInput) {
                        usernameInput.value = worker.username;
                        usernameInput.dataset.original = worker.username;
                    }

                    // Update Days Off Checkboxes
                    const daysOff = worker.daysOff || [];
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
            // Editing Salon (Global Content) - HIDE Profile Section as per user request
            if (profileSection) profileSection.style.display = 'none';
        }
    };

    // Inject Days Off UI
    const passInput = document.getElementById('profile-new-pass');
    if (passInput && !document.getElementById('days-off-container')) {
        const wrapper = document.createElement('div');
        wrapper.id = 'days-off-container';
        wrapper.style.marginTop = '15px';
        wrapper.style.display = 'none'; // Hidden by default (until worker selected)

        wrapper.innerHTML = `
            <label style="display:block; margin-bottom:5px;">Jours de repos hebdomadaires :</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, index) => {
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
    // Check if button already exists to prevent duplication
    let deleteBtn = document.getElementById('btn-delete-profile');

    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'btn-delete-profile';
        deleteBtn.className = 'btn';
        deleteBtn.style.backgroundColor = '#d32f2f';
        deleteBtn.style.color = '#ffffff';
        deleteBtn.style.border = 'none';
        deleteBtn.style.padding = '10px 20px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.marginTop = '0px';
        deleteBtn.textContent = 'Supprimer ce profil';
        deleteBtn.style.display = 'none';
        deleteBtn.style.verticalAlign = 'middle';
        deleteBtn.style.width = 'auto';

        const submitBtn = profileForm.querySelector('button[type="submit"]');

        if (submitBtn) {
            let container = submitBtn.parentNode;
            // Ensure we are in form-actions and not creating nested ones
            if (!container.classList.contains('form-actions')) {
                // Check if a form-actions sibling exists? No, usually we wrap.
                // But if we run this logic again on re-init, we might double wrap.
                // Best to verify structure.
                const wrapper = document.createElement('div');
                wrapper.className = 'form-actions';
                container.insertBefore(wrapper, submitBtn);
                wrapper.appendChild(submitBtn);
                container = wrapper;
            }
            container.appendChild(deleteBtn);
        }
    }

    deleteBtn.onclick = async (e) => {
        e.preventDefault();
        const adminId = filterEl.value;
        if (!adminId) return;

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
                await loadWorkersForFilter();
                filterEl.value = "";
                loadAppointments();
            } else {
                const err = await res.json();
                alert('Erreur: ' + (err.error || 'Impossible de supprimer'));
            }
        } catch (error) {
            console.error(error);
            alert('Erreur réseau');
        }
    };

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

    filterEl.removeEventListener('change', updateProfileView);
    filterEl.addEventListener('change', wrappedUpdateView);

    wrappedUpdateView();

    // Handle Submit
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminId = filterEl.value;
        const displayname = displayInput.value;
        const username = document.getElementById('profile-username')?.value; // Get username
        const newpass = document.getElementById('profile-new-pass').value;

        try {
            let res;
            let sendEmails = false;
            let forceDelete = false;
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
                        const hasEmails = conflicts.some(c => c.email && c.email.trim() !== '');
                        const isPlural = conflicts.length > 1;
                        const someMissingEmail = conflicts.some(c => !c.email || c.email.trim() === '');
                        let msg = `Attention: ${conflicts.length} rendez-vous exist${isPlural ? 'ent' : 'e'} sur ces nouveaux jours de repos :\n\n` +
                            conflicts.map(c => `- ${formatDateDisplay(c.date)} ${c.time} : ${c.name} (${c.phone || 'Sans tél'})`).join('\n') +
                            `\n\n${isPlural ? 'Ces rendez-vous seront supprimés' : 'Ce rendez-vous sera supprimé'}.\n\nVoulez-vous appliquer ces changements ?`;

                        // Check if Email Config is present in the form (Admin Context)
                        const emailUser = document.getElementById('email-config-user')?.value;
                        const emailHost = document.getElementById('email-config-host')?.value;
                        const isEmailConfigured = (emailUser && emailHost);

                        if (hasEmails && isEmailConfigured) {
                            msg += `\n(Une option pour envoyer un email d'annulation automatique vous sera proposée à l'étape suivante.)`;
                        } else if (hasEmails && !isEmailConfigured) {
                            msg += `\n(L'envoi d'email est désactivé car le serveur SMTP n'est pas configuré.)`;
                        }

                        if (someMissingEmail) {
                            const missingList = conflicts.filter(c => !c.email || c.email.trim() === '');
                            msg += `\n\n⚠️ Clients sans email (à contacter par téléphone) :\n` +
                                missingList.map(c => `- ${c.name}`).join('\n');
                        }

                        if (!confirm(msg)) {
                            return; // Abort
                        }

                        // Force Delete enabled by user confirmation
                        forceDelete = true;

                        // Second confirmation only if emails exist AND configured
                        if (hasEmails && isEmailConfigured) {
                            if (confirm("Voulez-vous envoyer un email d'annulation aux clients concernés ?")) {
                                sendEmails = true;
                            }
                        }
                    }
                }


                // Update Worker
                res = await fetch(`${API_URL}/workers/${adminId}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ displayName: displayname, username: username, password: newpass, daysOff: daysOff, sendEmails: sendEmails, forceDelete: forceDelete })
                });
            } else {
                // Update Self
                res = await fetch(`${API_URL}/profile`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ displayName: displayname, username: username, newPassword: newpass })
                });
            }

            if (res.ok) {
                // Smart Logout Logic
                // 1. Check if we are editing ourselves
                const isSelf = !adminId || (window.currentUserId && adminId == window.currentUserId);

                // 2. Check if credentials actually changed
                const original = document.getElementById('profile-username')?.dataset.original;
                const usernameChanged = username && original && username !== original;
                const passwordChanged = newpass && newpass.trim() !== '';

                if (isSelf && (usernameChanged || passwordChanged)) {
                    alert('Profil mis à jour. Vos identifiants ont changé, vous allez être déconnecté.');
                    localStorage.removeItem('auth');
                    window.location.reload();
                    return;
                } else {
                    alert('Profil mis à jour.');
                }

                document.getElementById('profile-new-pass').value = '';

                // If updating self username, update original data to prevent future false triggers
                if (isSelf && usernameChanged) {
                    const uInput = document.getElementById('profile-username');
                    if (uInput) uInput.dataset.original = username;
                }

                // Reload Admin Filter to update cache (Worker Names, Days Off)
                await loadWorkersForFilter();

                // If we edited a specific worker, re-select them in the filter to keep context
                if (adminId) {
                    filterEl.value = adminId;
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
        let sendEmails = false;

        if (conflicts.length > 0) {
            const hasEmails = conflicts.some(c => c.email && c.email.trim() !== '');
            const someMissingEmail = conflicts.some(c => !c.email || c.email.trim() === '');

            const isPlural = conflicts.length > 1;
            let msg = `Attention: ${conflicts.length} rendez-vous exist${isPlural ? 'ent' : 'e'} pendant cette période :\n\n` +
                conflicts.map(c => `- ${formatDateDisplay(c.date)} ${c.time} : [${c.worker_name || c.worker_username || 'Salon'}] ${c.name} (${c.phone || 'Sans tél'})`).join('\n') +
                `\n\n${isPlural ? 'Ces rendez-vous seront supprimés' : 'Ce rendez-vous sera supprimé'}.\n\nVoulez-vous bloquer cette période ?`;

            if (hasEmails) {
                msg += `\n(Une option pour envoyer un email d'annulation automatique vous sera proposée à l'étape suivante.)`;
            }

            if (someMissingEmail) {
                const missingList = conflicts.filter(c => !c.email || c.email.trim() === '');
                msg += `\n\n⚠️ Clients sans email (à contacter par téléphone) :\n` +
                    missingList.map(c => `- ${c.name}`).join('\n');
            }

            if (!confirm(msg)) {
                return; // Abort
            }

            // Second confirmation for Emails only if relevant
            if (hasEmails) {
                if (confirm("Voulez-vous envoyer un email d'annulation aux clients concernés ?")) {
                    sendEmails = true;
                }
            }
        }

        const res = await fetch(`${API_URL}/leaves`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                start,
                end,
                adminId: adminId, // Controller handles "" as null
                note: adminId ? 'Congés Coiffeur' : 'Fermeture',
                sendEmails
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erreur lors de la sauvegarde');
        }

        // Success Feedback
        if (sendEmails) {
            alert('Congés ajoutés et emails d\'annulation envoyés.');
        } else {
            alert('Congés ajoutés avec succès');
        }

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
            <td><input type="time" class="sched-break-start" value="${dayData.breakStart || ''}" ${!dayData.isOpen ? 'disabled' : ''} onchange="validateScheduleRow(this.closest('tr'))"></td>
            <td><input type="time" class="sched-break-end" value="${dayData.breakEnd || ''}" ${!dayData.isOpen ? 'disabled' : ''}></td>
            <td><input type="time" class="sched-end" value="${dayData.close}" ${!dayData.isOpen ? 'disabled' : ''} onchange="validateScheduleRow(this.closest('tr'))"></td>
        `;
        tbody.appendChild(tr);
        validateScheduleRow(tr); // Initial validation
    });
}

function validateScheduleRow(tr) {
    if (!tr) return;
    const endInput = tr.querySelector('.sched-end');
    const breakStartInput = tr.querySelector('.sched-break-start');
    const breakEndInput = tr.querySelector('.sched-break-end');
    const isOpen = tr.querySelector('.sched-open').checked;

    if (!isOpen) return; // Already disabled by toggleRow

    const closeTime = endInput.value;
    const breakStartTime = breakStartInput.value;
    const breakEndTime = breakEndInput.value;

    // Logic: If Close Time <= Break End Time (or generic early closing), disable breaks
    // If user sets Close to 13:00, and Break End is 14:00 -> Disable Break.
    // But what if Break Start is EMPTY? 
    // We rely on the values present.

    if (closeTime && breakEndTime && closeTime <= breakEndTime) {
        breakStartInput.disabled = true;
        breakEndInput.disabled = true;
    } else {
        // Re-enable (unless row is closed, handled by toggleRow)
        breakStartInput.disabled = false;
        breakEndInput.disabled = false;
    }
}
window.validateScheduleRow = validateScheduleRow;

export function toggleRow(checkbox) {
    const tr = checkbox.closest('tr');
    const inputs = tr.querySelectorAll('input[type="time"]');
    inputs.forEach(inp => inp.disabled = !checkbox.checked);

    if (checkbox.checked) {
        validateScheduleRow(tr);
    }
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


export async function deleteEmailConfig() {
    if (!confirm('Supprimer la configuration email ?\n\nLe site ne pourra plus envoyer de confirmations de RDV.')) {
        return;
    }

    try {
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email_config: null })
        });

        // Clear Fields
        document.getElementById('email-config-user').value = '';
        document.getElementById('email-config-pass').value = '';
        document.getElementById('email-config-host').value = '';
        document.getElementById('email-config-port').value = '';

        alert('Configuration supprimée.');
    } catch (e) {
        console.error(e);
        alert('Erreur lors de la suppression');
    }
}
window.deleteEmailConfig = deleteEmailConfig;

// Identity Management
export async function saveIdentitySettings() {
    const name = document.getElementById('salon-name').value;
    try {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        const { salon_identity } = await res.json();
        const currentLogo = salon_identity?.logo || null;

        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                salon_identity: {
                    name: name,
                    logo: currentLogo
                }
            })
        });
        alert('Identité enregistrée !');
        loadSettings();
    } catch (e) {
        alert('Erreur lors de la sauvegarde');
    }
}
window.saveIdentitySettings = saveIdentitySettings;





// Upload listener moved to content.js

