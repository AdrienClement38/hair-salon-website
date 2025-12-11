const dateInput = document.getElementById('date');
const slotsContainer = document.getElementById('slots-container');
const selectedTimeInput = document.getElementById('selected-time');
const bookingForm = document.getElementById('booking-form');
const messageBox = document.getElementById('form-message');

// Set min date to today
const today = new Date().toISOString().split('T')[0];
dateInput.min = today;

// Polling System
let lastDataTimestamp = 0;

async function pollUpdates() {
    try {
        const res = await fetch(`/api/updates?lastTimestamp=${lastDataTimestamp}`);
        const data = await res.json();

        if (data.needsUpdate) {
            lastDataTimestamp = data.currentTimestamp;
            console.log('Update detected, refreshing data...');

            // Refresh settings
            loadSettings();

            // Refresh slots if date selected
            if (dateInput.value) {
                loadSlots(dateInput.value);
            }

            // Refresh Hero (if we tracked content versioning, for now just simplistic reload if needed)
            const hero = document.querySelector('.hero');
            if (hero) {
                hero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('hero-bg.jpg?t=${lastDataTimestamp}')`;
            }
        }
    } catch (err) {
        console.warn('Polling error:', err);
    }
}

// Start Polling (5s interval)
setInterval(pollUpdates, 5000);


dateInput.addEventListener('change', async (e) => {
    const date = e.target.value;
    if (!date) return;
    loadSlots(date);
});

async function loadSlots(date) {
    slotsContainer.innerHTML = '<p class="text-muted">Chargement...</p>';
    selectedTimeInput.value = '';

    try {
        const res = await fetch(`/api/slots?date=${date}`);
        const slots = await res.json();

        renderSlots(slots);
    } catch (err) {
        slotsContainer.innerHTML = '<span style="color:red">Erreur lors du chargement des créneaux.</span>';
    }
}

function renderSlots(slots) {
    slotsContainer.innerHTML = '';

    if (slots.length === 0) {
        slotsContainer.innerHTML = '<p class="text-muted">Aucun créneau disponible (Fermé ou Complet).</p>';
        return;
    }

    slots.forEach(slot => {
        const btn = document.createElement('div');
        btn.className = `slot-btn ${slot.isAvailable ? '' : 'disabled'}`;
        btn.textContent = slot.time;

        if (slot.isAvailable) {
            btn.onclick = () => selectSlot(btn, slot.time);
        }

        slotsContainer.appendChild(btn);
    });
}

function selectSlot(btn, time) {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTimeInput.value = time;
}

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const service = document.getElementById('service').value;
    const date = dateInput.value;
    const time = selectedTimeInput.value;

    if (!time) {
        showMessage('Veuillez sélectionner un créneau horaire.', 'error');
        return;
    }

    const data = { name, phone, service, date, time };

    try {
        const res = await fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (res.ok) {
            // Refresh slots immediately to show it's taken
            if (dateInput.value) loadSlots(dateInput.value);
            // Trigger poll update manually implies we might want to update timestamp locally too, but server handles it.
            // The poll will eventually sync, but immediate feedback is better.
            showMessage(`Rendez-vous confirmé pour le ${formatDateDisplay(date)} à ${time} !`, 'success');
            bookingForm.reset();
            slotsContainer.innerHTML = '<p class="text-muted">Sélectionnez une date pour voir les créneaux.</p>';
            selectedTimeInput.value = '';
        } else {
            showMessage(result.error || 'Erreur lors de la réservation.', 'error');
        }
    } catch (err) {
        showMessage('Erreur réseau.', 'error');
    }
});

// Initial Load
loadSettings();

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        renderOpeningHours(data.openingHours);
    } catch (err) {
        console.error('Failed to load settings', err);
    }
}

function renderOpeningHours(openingHours) {
    const container = document.getElementById('opening-hours-display');
    if (!container) return;

    if (!openingHours) {
        container.innerHTML = '';
        return;
    }

    // Normalize to array
    let schedule = [];
    if (Array.isArray(openingHours)) {
        schedule = openingHours;
    } else {
        // Fallback for legacy object (shouldn't happen if server migrates, but for safety)
        const start = openingHours.start || '09:00';
        const end = openingHours.end || '18:00';
        const closed = openingHours.closedDays || [];
        for (let i = 0; i < 7; i++) {
            schedule[i] = { open: start, close: end, isOpen: !closed.includes(i) };
        }
    }

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const groups = [];

    // Group contiguous days (1=Mon to 0=Sun logic for grouping display?)
    // Let's iterate 1..6 then 0.
    const uiOrder = [1, 2, 3, 4, 5, 6, 0];

    let currentGroup = null;

    uiOrder.forEach(dayIdx => {
        const dayData = schedule[dayIdx] || { isOpen: false };
        const dayLabel = dayNames[dayIdx];

        let timeStr = dayData.isOpen ? `${dayData.open}-${dayData.close}` : 'Fermé';

        if (currentGroup && currentGroup.time === timeStr) {
            currentGroup.endDay = dayLabel;
            currentGroup.count++;
        } else {
            if (currentGroup) groups.push(currentGroup);
            currentGroup = { startDay: dayLabel, endDay: dayLabel, time: timeStr, count: 1 };
        }
    });
    if (currentGroup) groups.push(currentGroup);

    let html = '';
    groups.forEach(g => {
        let label = g.startDay;
        if (g.count > 1) {
            // If count is 2, say "Lun, Mar". If > 2, "Lun - Mer"? 
            // Simple logic: if count > 2 imply range?
            // "Lun - Ven" is classic.
            if (g.count > 2) label += ` - ${g.endDay}`;
            else if (g.count === 2) label += `, ${g.endDay}`; // Or just separate lines?
            // Actually, if it's contiguous in uiOrder, range notation is fine.
        }

        html += `<div><strong>${label} :</strong> ${g.time}</div>`;
    });

    container.innerHTML = html;
}

function showMessage(msg, type) {
    messageBox.textContent = msg;
    messageBox.style.color = type === 'success' ? 'green' : 'red';
}

function formatDateDisplay(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[2]}--${parts[1]}--${parts[0]}`;
}
