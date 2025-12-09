const socket = io(); // Connect to Socket

const dateInput = document.getElementById('date');
const slotsContainer = document.getElementById('slots-container');
const selectedTimeInput = document.getElementById('selected-time');
const bookingForm = document.getElementById('booking-form');
const messageBox = document.getElementById('form-message');

// Set min date to today
const today = new Date().toISOString().split('T')[0];
dateInput.min = today;

// Real-time Listeners
socket.on('appointment_updated', () => {
    // Refresh slots if a date is selected
    if (dateInput.value) {
        loadSlots(dateInput.value);
    }
});

socket.on('settings_updated', () => {
    // Refresh slots to reflect new hours/holidays
    if (dateInput.value) {
        loadSlots(dateInput.value);
    }
});

socket.on('content_updated', () => {
    // Reload hero image
    // In a real app we might update more gracefully, here we can just reload the bg or do nothing until refresh
    // For hero-bg, let's try to update it
    const hero = document.querySelector('.hero');
    hero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('hero-bg.jpg?t=${new Date().getTime()}')`;
});


dateInput.addEventListener('change', async (e) => {
    const date = e.target.value;
    if (!date) return;
    loadSlots(date);
});

async function loadSlots(date) {
    slotsContainer.innerHTML = 'Chargement...';
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
        slotsContainer.innerHTML = 'Aucun créneau disponible (Fermé ou Complet).';
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
            // No need to manually refresh slots here, the socket event will handle it!
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

function showMessage(msg, type) {
    messageBox.textContent = msg;
    messageBox.style.color = type === 'success' ? 'green' : 'red';
}

function formatDateDisplay(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[2]}--${parts[1]}--${parts[0]}`;
}
