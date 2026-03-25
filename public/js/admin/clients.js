// public/js/admin/clients.js

let allClients = [];

export async function initClients() {
    const searchInput = document.getElementById('client-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderClients(e.target.value);
        });
    }

    // Real-time Updates
    const socket = typeof io !== 'undefined' ? io() : null;
    if (socket) {
        socket.on('appointmentsUpdated', () => {
            console.log('[Loyalty] Refreshing clients via WebSocket');
            loadClients();
        });
    }
}

export async function loadClients() {
    try {
        const token = localStorage.getItem('auth');
        const res = await fetch('/api/admin/clients', {
            headers: { 'Authorization': 'Basic ' + token }
        });
        if (res.ok) {
            allClients = await res.json();
            renderClients();
        } else {
            console.error('Failed to load clients');
        }
    } catch (e) {
        console.error('Error loading clients:', e);
    }
}

function renderClients(filter = '') {
    const tbody = document.getElementById('clients-tbody');
    const emptyMsg = document.getElementById('clients-empty-msg');
    if (!tbody) return;

    const filtered = allClients.filter(c => {
        const searchStr = `${c.name} ${c.email} ${c.phone}`.toLowerCase();
        return searchStr.includes(filter.toLowerCase());
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';
    tbody.innerHTML = filtered.map(c => {
        const phoneDisplay = formatPhone(c.phone);
        const optInBadge = c.opt_in_loyalty 
            ? '<span class="appt-badge" style="background:#4caf50; color:white">Actif</span>' 
            : '<span class="appt-badge" style="background:#9e9e9e; color:white">Inactif</span>';
        
        return `
            <tr>
                <td>
                    <div style="font-weight:bold;">${c.name}</div>
                    <div style="font-size:0.8rem; color:#666;">Depuis le ${new Date(c.created_at).toLocaleDateString()}</div>
                </td>
                <td>
                    <div style="font-size:0.9rem;">${c.email}</div>
                    <div class="phone-subtext">${phoneDisplay}</div>
                </td>
                <td style="font-weight:bold; color:#673ab7; white-space:nowrap;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn-circle" onclick="adjustPoints('${c.email}', -1)">-</button>
                        <span>${c.loyalty_points} pts</span>
                        <button class="btn-circle" onclick="adjustPoints('${c.email}', 1)">+</button>
                    </div>
                </td>
                <td>${optInBadge}</td>
                <td style="text-align:center;">
                    <button class="btn-delete" onclick="deleteClientLoyalty('${c.email}', '${c.name.replace("'", "\\'")}')" title="Supprimer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

export async function adjustPoints(email, delta) {
    try {
        const token = localStorage.getItem('auth');
        const res = await fetch(`/api/admin/clients/${email}/adjust`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Basic ${token}`
            },
            body: JSON.stringify({ delta })
        });
        if (res.ok) {
            const data = await res.json();
            // Update local state and re-render
            const client = allClients.find(c => c.email === email);
            if (client) client.loyalty_points = data.newPoints;
            renderClients(document.getElementById('client-search').value);
        }
    } catch (e) { console.error('Error adjusting points:', e); }
}

export async function deleteClientLoyalty(email, name) {
    if (!confirm(`Supprimer le client ${name} du programme de fidélité ?`)) return;
    
    try {
        const token = localStorage.getItem('auth');
        const res = await fetch(`/api/admin/clients/${email}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Basic ${token}` }
        });
        if (res.ok) {
            allClients = allClients.filter(c => c.email !== email);
            renderClients(document.getElementById('client-search').value);
        }
    } catch (e) { console.error('Error deleting client:', e); }
}

function formatPhone(phone) {
    if (!phone) return '-';
    let clean = phone.replace(/^\+33/, '0').replace(/\D/g, '');
    return clean.replace(/(\d{2})(?=\d)/g, '$1 ');
}

// Expose to window for onclick handlers
window.loadClients = loadClients;
window.adjustPoints = adjustPoints;
window.deleteClientLoyalty = deleteClientLoyalty;
