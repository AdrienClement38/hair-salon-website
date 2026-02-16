// public/js/public/booking.js
import { formatDateDisplay } from './config.js';
import { showMessage } from './ui.js';

const dateInput = document.getElementById('date');
const slotsContainer = document.getElementById('slots-container');
const selectedTimeInput = document.getElementById('selected-time');
const bookingForm = document.getElementById('booking-form');
const workerInput = document.getElementById('worker');
const serviceInput = document.getElementById('service');

let flatpickrInstance = null;
let salonSettings = {
    openingHours: { closedDays: [] },
    holidays: []
};
let availableWorkers = []; // Store workers with their schedule

export async function initBooking() {
    // Hide Submit Button Initially
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.style.display = 'none';

    // Helper to calculate rules
    window.updateCalendarRules = function () {
        if (!flatpickrInstance) return;

        const workerId = workerInput.value;
        // Use loose equality for string/number match
        const worker = availableWorkers.find(w => w.id == workerId);

        const rules = [];

        // 1. Global Holiday Ranges
        if (salonSettings.holidayRanges) {
            salonSettings.holidayRanges.forEach(range => {
                rules.push({ from: range.start, to: range.end });
            });
        }

        // 2. Worker Specific Leaves
        if (worker && worker.leaves) {
            worker.leaves.forEach(l => {
                rules.push({ from: l.start_date, to: l.end_date });
            });
        }

        // 3. Weekly & Single Dates
        rules.push(function (date) {
            const day = date.getDay(); // 0-6

            // Global Weekly Closing
            if (Array.isArray(salonSettings.openingHours)) {
                const dayConfig = salonSettings.openingHours.find(d => d.day === day);
                if (dayConfig && !dayConfig.isOpen) return true;
            } else if (salonSettings.openingHours && salonSettings.openingHours.closedDays &&
                salonSettings.openingHours.closedDays.includes(day)) {
                return true;
            }

            // Worker Weekly Off (if selected)
            if (worker && worker.daysOff && worker.daysOff.includes(day)) {
                return true;
            }

            // Global Single Holidays
            const dateStr = date.toISOString().split('T')[0];
            if (salonSettings.holidays && salonSettings.holidays.includes(dateStr)) {
                return true;
            }

            return false;
        });

        flatpickrInstance.set('disable', rules);
    };

    // 1. Fetch Settings (for Calendar Constraints)
    try {
        const res = await fetch(`/api/settings?t=${Date.now()}`);
        const settings = await res.json();
        salonSettings = settings;
    } catch (e) {
        console.error("Error loading settings for calendar", e);
    }

    // 2. Initialize Flatpickr
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2);

    // Prepare Disable Array
    const disableRules = [];

    // 1. Add Holiday Ranges (Global Leaves)
    if (salonSettings.holidayRanges) {
        salonSettings.holidayRanges.forEach(range => {
            disableRules.push({ from: range.start, to: range.end });
        });
    }

    // 2. Add Function for Weekly Closures & Single Holidays
    disableRules.push(function (date) {
        // Check Weekly Closing
        const day = date.getDay(); // 0 (Sun) to 6 (Sat)

        if (Array.isArray(salonSettings.openingHours)) {
            const dayConfig = salonSettings.openingHours.find(d => d.day === day);
            if (dayConfig && !dayConfig.isOpen) {
                return true;
            }
        }
        else if (salonSettings.openingHours && salonSettings.openingHours.closedDays &&
            salonSettings.openingHours.closedDays.includes(day)) {
            return true;
        }

        // Check Holidays (Single Dates)
        const dateStr = date.toISOString().split('T')[0];
        if (salonSettings.holidays && salonSettings.holidays.includes(dateStr)) {
            return true;
        }

        return false;
    });

    flatpickrInstance = flatpickr("#date", {
        locale: "fr",
        minDate: "today",
        maxDate: maxDate,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d-m-Y",
        altFormat: "d-m-Y",
        disableMobile: "true",
        // remove static disable array, we will set it dynamically
        disable: [],
        onReady: function () {
            updateCalendarRules(); // Set initial rules
        },
        onChange: function (selectedDates, dateStr, instance) {
            updateSlots();
        }
    });

    // Listeners
    // dateInput listener removed (handled by Flatpickr onChange)
    workerInput.addEventListener('change', () => {
        updateCalendarRules();
        updateSlots();
    });
    serviceInput.addEventListener('change', updateSlots);

    // Form Submit
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;
        const serviceOption = serviceInput.options[serviceInput.selectedIndex];
        const service = serviceOption.dataset.name || serviceInput.value; // Send Name!
        const adminId = workerInput.value;
        const date = dateInput.value;
        const time = selectedTimeInput.value;

        if (!time) {
            showMessage('Veuillez sélectionner un créneau horaire.', 'error');
            return;
        }

        const data = { name, phone, email, service, date, time, adminId };

        try {
            const res = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok) {
                const serviceName = serviceInput.options[serviceInput.selectedIndex].text;
                const workerName = workerInput.options[workerInput.selectedIndex].text;

                showMessage(`
                    <div>Rendez-vous confirmé pour <strong>${serviceName}</strong> avec <strong>${workerName}</strong></div>
                    <div class="booking-time-details">Le ${formatDateDisplay(date)} à ${time}</div>
                `, 'success');

                // Immediate Reset
                bookingForm.reset();
                if (flatpickrInstance) flatpickrInstance.clear();
                slotsContainer.innerHTML = '';
                selectedTimeInput.value = '';

                // Auto-hide message after 5 seconds
                setTimeout(() => {
                    showMessage('', '');
                }, 5000);
            } else {
                showMessage(result.error || 'Erreur lors de la réservation.', 'error');
            }
        } catch (err) {
            showMessage('Erreur réseau.', 'error');
        }
    });

    loadWorkers();
    loadServices();
}

function updateSlots() {
    const date = dateInput.value;

    if (date) {
        const selected = new Date(date);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Calculate limit: 2 months (approx 60 days or exactly 2 months?)
        // User said "2 mois". Date calculation is better with months.
        const limit = new Date(now);
        limit.setMonth(limit.getMonth() + 2); // Exactly 2 months

        if (selected > limit) {
            showMessage("La réservation est impossible plus de 2 mois à l'avance.", "error");

            // Auto hide error message after 10 seconds
            setTimeout(() => {
                const msgEl = document.getElementById('form-message');
                if (msgEl && msgEl.textContent.includes('impossible plus de 2 mois')) {
                    showMessage('', '');
                }
            }, 10000);

            dateInput.value = "";
            slotsContainer.innerHTML = '<p class="text-muted">Date invalide.</p>';
            return;
        }

        // Clear message if date is valid
        const msgEl = document.getElementById('form-message');
        if (msgEl && msgEl.textContent.includes('impossible plus de 2 mois')) {
            showMessage('', '');
        }
    }

    const workerId = workerInput.value;
    const serviceId = serviceInput.value;

    if (!date || !workerId || !serviceId) {
        slotsContainer.innerHTML = '<p class="text-muted">Sélectionnez un service, une date et un coiffeur.</p>';
        return;
    }
    loadSlots(date, workerId, serviceId);
}

async function loadSlots(date, adminId, serviceId) {
    slotsContainer.innerHTML = '<p class="text-muted">Chargement...</p>';
    selectedTimeInput.value = '';

    // Hide Submit Button while loading/rendering new slots
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.style.display = 'none';

    try {
        const res = await fetch(`/api/slots?date=${date}&adminId=${adminId}&serviceId=${serviceId}`);
        const data = await res.json();
        renderSlots(data.slots || [], data.reason);
    } catch (err) {
        slotsContainer.innerHTML = '<span style="color:red">Erreur lors du chargement des créneaux.</span>';
    }
}

function renderSlots(slots, reason) {
    slotsContainer.innerHTML = '';

    if (!slots || slots.length === 0) {
        let message = 'Aucun créneau disponible.';
        const workerName = workerInput.options[workerInput.selectedIndex]?.text || "Le coiffeur";

        if (reason === 'leave' || reason === 'worker_off_day') {
            message = `${workerName} est absent(e) à cette date.`;
        } else if (reason === 'holiday' || reason === 'closed') {
            message = 'Le salon est fermé.';
        } else if (reason === 'full') {
            message = 'Complet pour cette date.';
            // Hide Submit Button
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.style.display = 'none';

            // Add Waitlist Button
            const btn = document.createElement('button');
            btn.type = 'button';
            // Use EXACT SAME classes as the "Confirmer le RDV" button: btn btn-gold full-width
            btn.className = 'btn btn-gold full-width';
            btn.textContent = "M'INSCRIRE SUR LISTE D'ATTENTE"; // No emoji, uppercase like default buttons
            btn.onclick = joinWaitlist;



            slotsContainer.innerHTML = `<p class="text-muted">${message}</p>`;
            slotsContainer.appendChild(btn);

            // Add explainer text
            const explainer = document.createElement('p');
            explainer.style.fontSize = '0.9em';
            explainer.style.color = '#666';
            explainer.style.marginTop = '10px';
            explainer.style.fontStyle = 'italic';
            explainer.style.textAlign = 'center';
            explainer.textContent = "Un email récapitulatif vous sera envoyé confirmant votre inscription.";
            slotsContainer.appendChild(explainer);

            return;
        }

        slotsContainer.innerHTML = `<p class="text-muted">${message}</p>`;
        return;
    }



    slots.forEach(time => {
        const btn = document.createElement('div');
        btn.className = 'slot-btn';
        btn.textContent = time;

        btn.onclick = () => selectSlot(btn, time);

        slotsContainer.appendChild(btn);
    });
}

function selectSlot(btn, time) {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTimeInput.value = time;

    // Show Submit Button
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.style.display = 'block';
}

async function loadWorkers() {
    try {
        const res = await fetch(`/api/workers?t=${Date.now()}`);
        const workers = await res.json();
        availableWorkers = workers; // Store for calendar logic

        workerInput.innerHTML = '<option value="">-- Choisir --</option>';
        workers.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name;
            workerInput.appendChild(opt);
        });

    } catch (e) {
        workerInput.innerHTML = '<option value="">Erreur chargement</option>';
    }
}

export const refreshBookingWorkers = loadWorkers;

export async function loadServices() {
    serviceInput.innerHTML = '<option value="">Chargement...</option>';
    try {
        const res = await fetch(`/api/settings?t=${Date.now()}`);
        const settings = await res.json();
        const services = settings.services || [];

        if (services.length === 0) {
            serviceInput.innerHTML = '<option value="">Aucun service disponible</option>';
            return;
        }

        serviceInput.innerHTML = '<option value="">-- Choisir une prestation --</option>';
        services.forEach(s => {
            const opt = document.createElement('option');
            // Use service ID as value for slots, but store Name for booking
            opt.value = s.id;
            opt.dataset.name = s.name;
            opt.textContent = `${s.name} - ${s.price}€ (${s.duration || 30} min)`;
            serviceInput.appendChild(opt);
        });
    } catch (e) {
        console.error("Error loading services", e);
        serviceInput.innerHTML = '<option value="">Erreur de chargement</option>';
    }
}

// Export for reloading
export const refreshSlots = () => {
    if (dateInput.value) updateSlots();
};

// --- WAITING LIST LOGIC ---

async function joinWaitlist() {
    // 1. Get Form Data
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const date = dateInput.value;
    const workerId = workerInput.value;
    const serviceId = serviceInput.value;

    // 2. Validate
    if (!name || !email) {
        // Find or create message element in slots container
        let msgEl = document.getElementById('wl-inline-message');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.id = 'wl-inline-message';
            msgEl.style.marginTop = '10px';
            msgEl.style.fontWeight = 'bold';
            slotsContainer.appendChild(msgEl);
        }

        msgEl.className = 'text-center';
        msgEl.style.color = 'red';
        msgEl.textContent = "Veuillez remplir votre Nom et Email pour vous inscrire.";
        return;
    }




    // 3. UI Feedback (Loading)
    const btn = document.querySelector('.btn-gold.full-width');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'INSCRIPTION EN COURS...';

    // Clear previous messages
    const existingMsg = document.getElementById('wl-inline-message');
    if (existingMsg) existingMsg.remove();

    // Create or find explanation text container (if you want it separate from error/success msg)
    // User requested text: "il faut que sous ou au dessus du bouton je m'inscris sur liste d'attente, il y ait le texte qui dit qu'un mail récapitulatif va être envoyé"

    const serviceOption = serviceInput.options[serviceInput.selectedIndex];
    const serviceName = serviceOption.dataset.name || serviceInput.value;

    const payload = {
        name,
        email,
        phone,
        target_date: date,
        desired_worker_id: workerId ? parseInt(workerId) : null,
        desired_service_id: serviceName // Service Name required for logic
    };

    try {
        const res = await fetch('/api/waiting-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        // Response Message Element
        const msgEl = document.createElement('div');
        msgEl.id = 'wl-inline-message';
        msgEl.style.marginTop = '15px';
        msgEl.style.padding = '10px';
        msgEl.style.borderRadius = '4px';
        msgEl.style.textAlign = 'center';
        msgEl.style.fontWeight = 'bold';

        if (res.ok) {
            msgEl.style.backgroundColor = '#e6fffa';
            msgEl.style.color = '#00b894';
            msgEl.style.border = '1px solid #55efc4';
            msgEl.innerHTML = `
                ✅ Vous êtes inscrit ! <br>
                <span style="font-weight:normal; font-size:0.9em; color:#666">
                    Si un créneau se libère, vous recevrez un "Golden Ticket" par email.
                </span>
            `;
            // Hide button on success
            btn.style.display = 'none';

            // Reset entire form
            const bookingForm = document.getElementById('booking-form');
            if (bookingForm) bookingForm.reset();

            // Disappear after 4 seconds and refresh view
            setTimeout(() => {
                // Reset UI: clear container and reload slots for current state
                slotsContainer.innerHTML = '';
                if (typeof updateSlots === 'function') {
                    updateSlots();
                } else if (window.loadSlots) {
                    // Fallback to loadSlots if updateSlots is maybe not global?
                    // But initBooking should expose updateSlots? No.
                    // updateSlots is defined in this file. 
                    // To be safe we try to call it.
                }

                // Actually updateSlots is defined in the top level scope of this script.
                // Call it directly.
                try {
                    updateSlots();
                } catch (e) {
                    console.error("Could not refresh slots", e);
                    slotsContainer.innerHTML = '';
                }
            }, 4000);
        } else {
            msgEl.style.backgroundColor = '#fff3cd'; // Warn yellow/orange for conflicts
            msgEl.style.color = '#856404';
            msgEl.style.border = '1px solid #ffeeba';

            // Check if specific error to add icon
            if (data.error && data.error.includes("déjà sur la liste")) {
                msgEl.innerHTML = `<strong>Attention</strong><br>${data.error}`;
            } else {
                msgEl.textContent = data.error || "Erreur lors de l'inscription.";
                // Reset to red for generic errors
                msgEl.style.backgroundColor = '#ffe6e6';
                msgEl.style.color = '#d63031';
                msgEl.style.border = '1px solid #ff7675';
            }

            btn.disabled = false;
            btn.textContent = originalText;
        }

        slotsContainer.appendChild(msgEl);

    } catch (e) {
        console.error(e);
        const msgEl = document.createElement('div');
        msgEl.id = 'wl-inline-message';
        msgEl.style.color = 'red';
        msgEl.style.textAlign = 'center';
        msgEl.style.marginTop = '10px';
        msgEl.textContent = "Erreur technique. Veuillez réessayer.";
        slotsContainer.appendChild(msgEl);

        btn.disabled = false;
        btn.textContent = originalText;
    }
}
