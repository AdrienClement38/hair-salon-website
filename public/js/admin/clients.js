// public/js/admin/clients.js

let allClients = [];
let currentPage = 1;
const itemsPerPage = 25;

export async function initClients() {
    const searchInput = document.getElementById('lo-srch-field');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentPage = 1; // reset page on search
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
    const paginationContainer = document.getElementById('clients-pagination');
    if (!tbody) return;

    let filtered = allClients.filter(c => {
        const searchStr = `${c.name} ${c.email} ${c.phone}`.toLowerCase();
        return searchStr.includes(filter.toLowerCase());
    });

    // Stable sort: Alphabetical by name, then registration date
    filtered.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        // Fallback: Registration date (oldest first)
        const dateA = new Date(a.created_at || parseInt(a.id || 0)).getTime();
        const dateB = new Date(b.created_at || parseInt(b.id || 0)).getTime();
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;

        // Final absolute fallback (just in case they registered at the exact same millisecond)
        const emailA = (a.email || '').toLowerCase();
        const emailB = (b.email || '').toLowerCase();
        if (emailA < emailB) return -1;
        if (emailA > emailB) return 1;
        return 0;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    emptyMsg.style.display = 'none';

    // Pagination bounds
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageData = filtered.slice(startIndex, startIndex + itemsPerPage);

    tbody.innerHTML = pageData.map(c => {
        const phoneDisplay = formatPhone(c.phone);
        
        return `
            <tr>
                <td class="col-client-info">
                    <div style="font-weight:bold;">${c.name}</div>
                    <div class="mobile-only" style="font-size:0.85rem; color:#333; margin-top:4px;">${c.email}</div>
                    <div class="mobile-only phone-subtext" style="font-size:0.8rem; color:#666;">${phoneDisplay}</div>
                    <div class="desktop-only" style="font-size:0.75rem; color:#888; margin-top:2px;">Depuis le ${new Date(c.created_at).toLocaleDateString()}</div>
                </td>
                <td class="col-contact-info desktop-only">
                    <div style="font-size:0.9rem;">${c.email}</div>
                    <div class="phone-subtext">${phoneDisplay}</div>
                </td>
                <td class="col-points-info" style="font-weight:bold; color:#673ab7; white-space:nowrap;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                        <button class="btn-circle" onclick="adjustPoints('${c.email}', -1)">-</button>
                        <span>${c.loyalty_points} pts</span>
                        <button class="btn-circle" onclick="adjustPoints('${c.email}', 1)">+</button>
                    </div>
                </td>
                <td class="col-actions-info" style="text-align:center;">
                    <button class="btn-x" onclick="deleteClientLoyalty('${c.email}', '${c.name.replace("'", "\\'")}')" title="Supprimer">
                        &times;
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Pagination controls
    if (paginationContainer) {
        if (totalPages > 1) {
            let pagHtml = '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding: 10px 0; border-top: 1px solid #eee;">';
            pagHtml += `<button class="btn btn-secondary" style="padding:6px 12px; width:auto; border-radius:4px" onclick="changeClientPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>&laquo; Précédent</button>`;
            pagHtml += `<span style="font-weight:bold; color:#666; font-size: 0.95rem;">Page ${currentPage} sur ${totalPages}</span>`;
            pagHtml += `<button class="btn btn-secondary" style="padding:6px 12px; width:auto; border-radius:4px" onclick="changeClientPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Suivant &raquo;</button>`;
            pagHtml += '</div>';
            paginationContainer.innerHTML = pagHtml;
        } else {
            paginationContainer.innerHTML = '';
        }
    }
}

export function changeClientPage(page) {
    currentPage = page;
    const searchInput = document.getElementById('lo-srch-field');
    renderClients(searchInput ? searchInput.value : '');
}

export async function adjustPoints(email, delta) {
    try {
        const token = localStorage.getItem('auth');
        const res = await fetch(`/api/admin/clients/${email}/adjust`, {
            method: 'PATCH',
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
            renderClients(document.getElementById('lo-srch-field').value);
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
            renderClients(document.getElementById('lo-srch-field').value);
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
window.changeClientPage = changeClientPage;
