const API_URL = '/api/admin';
const socket = io();

// LocalStorage Persistence
let authCreds = JSON.parse(localStorage.getItem('salon_auth'));

const loginForm = document.getElementById('login-form');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const appointmentsContainer = document.getElementById('appointments-container');

// Init
if (authCreds) {
    verifyAuth();
} else {
    loginView.style.display = 'flex';
}

// Helpers
function getHeaders() {
    return {
        'Authorization': 'Basic ' + btoa(authCreds.user + ':' + authCreds.pass),
        'Content-Type': 'application/json'
    };
}

function formatDateDisplay(dateStr) {
    // YYYY-MM-DD -> DD--MM--YYYY
    const parts = dateStr.split('-');
    return `${parts[2]}--${parts[1]}--${parts[0]}`;
}

async function verifyAuth() {
    try {
        const res = await fetch(`${API_URL}/appointments`, { headers: getHeaders() });
        if (res.ok) {
            loginView.style.display = 'none';
            dashboardView.style.display = 'block';
            loadDashboard();
        } else {
            console.warn('Auth failed or expired');
            localStorage.removeItem('salon_auth');
            loginView.style.display = 'flex';
        }
    } catch (err) {
        console.error(err);
    }
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    authCreds = { user, pass };

    try {
        const res = await fetch(`${API_URL}/appointments`, { headers: getHeaders() });
        if (res.ok) {
            localStorage.setItem('salon_auth', JSON.stringify(authCreds));
            loginView.style.display = 'none';
            dashboardView.style.display = 'block';
            loadDashboard();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (err) {
        console.error(err);
    }
});

function logout() {
    localStorage.removeItem('salon_auth');
    location.reload();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    // In a real app we'd toggle the button active class too
}

// Real-time Listeners
socket.on('appointment_updated', () => {
    if (dashboardView.style.display === 'block') {
        loadAppointments();
    }
});

socket.on('settings_updated', () => {
    if (dashboardView.style.display === 'block') {
        loadSettings();
    }
});

// Data Loading
async function loadDashboard() {
    loadAppointments();
    loadSettings();
}

async function loadAppointments() {
    const res = await fetch(`${API_URL}/appointments`, { headers: getHeaders() });
    const data = await res.json();

    // Group by Date
    const grouped = {};
    data.forEach(apt => {
        if (!grouped[apt.date]) grouped[apt.date] = [];
        grouped[apt.date].push(apt);
    });

    // Render
    appointmentsContainer.innerHTML = '';

    // Sort dates ascending
    const dates = Object.keys(grouped).sort();

    dates.forEach(date => {
        const groupDiv = document.createElement('div');

        // Header
        const header = document.createElement('div');
        header.className = 'date-header';
        header.textContent = `📅 ${formatDateDisplay(date)}`;
        groupDiv.appendChild(header);

        // Table
        const table = document.createElement('table');
        table.innerHTML = `
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
                ${grouped[date].map(apt => `
                    <tr>
                        <td>${apt.time}</td>
                        <td>${apt.name}</td>
                        <td>${apt.phone || '-'}</td>
                        <td>${apt.service}</td>
                        <td>
                            <button class="btn-action btn-edit" onclick="openEdit(${apt.id}, '${apt.name.replace("'", "\\'")}', '${apt.date}', '${apt.time}')">Modifier</button>
                            <button class="btn-action btn-delete" onclick="deleteApt(${apt.id})">Suppr.</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        groupDiv.appendChild(table);
        appointmentsContainer.appendChild(groupDiv);
    });
}

// Actions
async function deleteApt(id) {
    if (!confirm('Êtes-vous sûr ?')) return;
    await fetch(`${API_URL}/appointments/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    // Socket will trigger reload
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
            // Socket will trigger reload
        } else {
            const err = await res.json();
            alert('Erreur: ' + (err.error || 'Impossible de modifier'));
        }
    } catch (e) {
        alert('Erreur réseau');
    }
}


// Settings
async function loadSettings() {
    const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
    const { openingHours, holidays } = await res.json();

    document.getElementById('open-time').value = openingHours.start;
    document.getElementById('close-time').value = openingHours.end;
    document.getElementById('holidays').value = holidays.join(', ');

    document.querySelectorAll('input[name="closed"]').forEach(cb => {
        cb.checked = openingHours.closedDays.includes(parseInt(cb.value));
    });
}

async function saveSettings() {
    const start = document.getElementById('open-time').value;
    const end = document.getElementById('close-time').value;
    const holidays = document.getElementById('holidays').value.split(',').map(s => s.trim()).filter(s => s);
    const closedDays = Array.from(document.querySelectorAll('input[name="closed"]:checked')).map(cb => parseInt(cb.value));

    const settings = {
        openingHours: { start, end, closedDays },
        holidays
    };

    await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings)
    });
    // Socket will trigger reload/alert elsewhere, here we just confirm
    alert('Configuration enregistrée !');
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
