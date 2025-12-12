// public/js/public/booking.js
import { formatDateDisplay } from './config.js';
import { showMessage } from './ui.js';

const dateInput = document.getElementById('date');
const slotsContainer = document.getElementById('slots-container');
const selectedTimeInput = document.getElementById('selected-time');
const bookingForm = document.getElementById('booking-form');
const workerInput = document.getElementById('worker');

export function initBooking() {
    // Set min date
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    // Listeners
    dateInput.addEventListener('change', updateSlots);
    workerInput.addEventListener('change', updateSlots);

    // Form Submit
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const service = document.getElementById('service').value;
        const adminId = workerInput.value;
        const date = dateInput.value;
        const time = selectedTimeInput.value;

        if (!time) {
            showMessage('Veuillez sélectionner un créneau horaire.', 'error');
            return;
        }

        const data = { name, phone, service, date, time, adminId };

        try {
            const res = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok) {
                if (dateInput.value) updateSlots();

                const serviceName = document.getElementById('service').options[document.getElementById('service').selectedIndex].text;
                const workerName = workerInput.options[workerInput.selectedIndex].text;

                showMessage(`Rendez-vous confirmé pour <strong>${serviceName}</strong> avec <strong>${workerName}</strong><br>Le ${formatDateDisplay(date)} à ${time}`, 'success');
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

    loadWorkers();
}

function updateSlots() {
    const date = dateInput.value;
    const workerId = workerInput.value;

    if (!date || !workerId) {
        slotsContainer.innerHTML = '<p class="text-muted">Sélectionnez une date et un coiffeur.</p>';
        return;
    }
    loadSlots(date, workerId);
}

async function loadSlots(date, adminId) {
    slotsContainer.innerHTML = '<p class="text-muted">Chargement...</p>';
    selectedTimeInput.value = '';

    try {
        const res = await fetch(`/api/slots?date=${date}&adminId=${adminId}`);
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

async function loadWorkers() {
    try {
        const res = await fetch('/api/workers');
        const workers = await res.json();

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

// Export for reloading
export const refreshSlots = () => {
    if (dateInput.value) updateSlots();
};
