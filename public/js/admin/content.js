// public/js/admin/content.js
import { API_URL, getHeaders } from './config.js';
import { currentHomeContent } from './state.js'; // Import current content

let currentPositioningImage = null; // 'hero' or 'philosophy'
let currentX = 50;
let currentY = 50;

export async function saveTextSettings() {
    const title = document.getElementById('content-title').value;
    const subtitle = document.getElementById('content-subtitle').value;
    const philosophy = document.getElementById('content-philosophy').value;
    const address = document.getElementById('content-address').value;
    const phone = document.getElementById('content-phone').value;

    // MERGE with existing content to preserve image positions
    const settings = {
        home_content: {
            ...currentHomeContent,
            title,
            subtitle,
            philosophy
        },
        contact_info: {
            address,
            phone
        }
    };

    try {
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        alert('Textes enregistrés !');
    } catch (e) {
        alert('Erreur lors de la sauvegarde');
    }
}

export function initContentForms() {
    // Images
    handleImageUpload('upload-hero', 'hero-bg');
    handleImageUpload('upload-philosophy', 'philosophy-bg');

    // Init positioning functionality
    initPositioning();

    // Profile listener moved to settings.js for dynamic handling

    // Team
    // Explicitly clear fields to fight browser autofill
    if (document.getElementById('team-username')) document.getElementById('team-username').value = '';
    if (document.getElementById('team-displayname')) document.getElementById('team-displayname').value = '';
    if (document.getElementById('team-password')) document.getElementById('team-password').value = '';

    document.getElementById('team-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('team-username').value;
        const displayname = document.getElementById('team-displayname').value;
        const password = document.getElementById('team-password').value;

        try {
            const res = await fetch(`${API_URL}/workers`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ username, displayname, password })
            });

            if (res.ok) {
                alert('Membre ajouté !');
                e.target.reset();
            } else {
                const errData = await res.json();
                alert('Erreur: ' + (errData.error || "Erreur lors de l'ajout"));
            }
        } catch (e) {
            alert('Erreur réseau');
        }
    });

    // Initial Thumb Load
    updateThumbnails();
    loadPortfolio();
}

// ... existing code ...

// --- Portfolio ---
export async function loadPortfolio() {
    const list = document.getElementById('portfolio-list');
    if (!list) return;

    try {
        const res = await fetch(`${API_URL}/portfolio`, { headers: getHeaders() });
        const items = await res.json();

        list.innerHTML = items.map(item => `
            <div class="portfolio-item">
                <img src="/images/${item.filename}" alt="Portfolio">
                <button class="btn-delete-overlay" onclick="deletePortfolioItem(${item.id})">&times;</button>
            </div>
        `).join('');
    } catch (e) {
        console.error("Error loading portfolio:", e);
    }
}

export async function addPortfolioItem() {
    // const descInput = document.getElementById('new-portfolio-desc'); // Removed
    const fileInput = document.getElementById('new-portfolio-file');

    if (!fileInput.files[0]) {
        alert("Veuillez sélectionner une image.");
        return;
    }

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    formData.append('description', ''); // Send empty string

    try {
        const res = await fetch(`${API_URL}/portfolio`, {
            method: 'POST',
            headers: { 'Authorization': getHeaders().Authorization },
            body: formData
        });

        if (res.ok) {
            // descInput.value = '';
            fileInput.value = '';
            loadPortfolio();
        } else {
            alert("Erreur lors de l'ajout.");
        }
    } catch (e) {
        console.error(e);
        alert("Erreur réseau.");
    }
}

export async function deletePortfolioItem(id) {
    if (!confirm("Supprimer cette photo ?")) return;
    try {
        const res = await fetch(`${API_URL}/portfolio/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (res.ok) loadPortfolio();
    } catch (e) {
        console.error(e);
    }
}

window.addPortfolioItem = addPortfolioItem;
window.deletePortfolioItem = deletePortfolioItem;

// Positioning Logic

function updateThumbnails() {
    const ts = Date.now();
    const heroThumb = document.getElementById('thumb-hero');
    const philoThumb = document.getElementById('thumb-philosophy');

    if (heroThumb) heroThumb.src = `/images/hero-bg?t=${ts}`;
    if (philoThumb) philoThumb.src = `/images/philosophy-bg?t=${ts}`;
}

function handleImageUpload(formId, fileName) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        formData.append('type', fileName === 'hero-bg' ? 'hero' : 'philosophy');

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': 'Basic ' + localStorage.getItem('auth') },
                body: formData
            });
            if (res.ok) {
                alert('Image mise à jour !');
                updateThumbnails(); // Refresh thumbnails
            } else {
                const err = await res.json();
                alert('Erreur upload: ' + (err.error || 'Erreur inconnue'));
            }
        } catch (e) {
            console.error(e);
            alert('Erreur réseau');
        }
    });
}

// Positioning Logic
// Positioning Logic
let onSaveCallback = null;

export function openGenericPositioning(imgUrl, initialX, initialY, onSave) {
    currentX = initialX || 50;
    currentY = initialY || 50;
    onSaveCallback = onSave;

    const modal = document.getElementById('position-modal');
    const img = document.getElementById('position-image');

    // Use timestamp to break cache
    img.src = `${imgUrl}?t=${Date.now()}`;

    if (initPositioning.initialized !== true) {
        initPositioning();
        initPositioning.initialized = true;
    }

    updateMarker();
    modal.style.display = 'flex';
}

function initPositioning() {
    const img = document.getElementById('position-image');

    img.addEventListener('click', (e) => {
        const rect = img.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let px = (x / rect.width) * 100;
        let py = (y / rect.height) * 100;

        px = Math.max(0, Math.min(100, px));
        py = Math.max(0, Math.min(100, py));

        currentX = Math.round(px * 10) / 10;
        currentY = Math.round(py * 10) / 10;

        updateMarker();
    });
}

export function openPositioning(type) {
    currentPositioningImage = type === 'hero-bg' ? 'hero' : 'philosophy';

    const existing = currentPositioningImage === 'hero'
        ? currentHomeContent.heroPosition
        : currentHomeContent.philosophyPosition;

    const imgUrl = `/images/${type === 'hero-bg' ? 'hero-bg' : 'philosophy-bg'}`;
    const x = existing ? existing.x : 50;
    const y = existing ? existing.y : 50;

    openGenericPositioning(imgUrl, x, y, async (newX, newY) => {
        const key = currentPositioningImage === 'hero' ? 'heroPosition' : 'philosophyPosition';
        const settings = {
            home_content: {
                ...currentHomeContent,
                [key]: { x: newX, y: newY }
            }
        };

        try {
            await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(settings)
            });
            alert('Position enregistrée !');
            currentHomeContent[key] = { x: newX, y: newY };
            closePositionModal();
        } catch (e) {
            alert('Erreur lors de la sauvegarde');
        }
    });
}

function updateMarker() {
    const marker = document.getElementById('position-marker');
    const coords = document.getElementById('position-coords');

    marker.style.left = `${currentX}%`;
    marker.style.top = `${currentY}%`;
    marker.style.display = 'block';

    if (coords) coords.textContent = `X: ${currentX}%  Y: ${currentY}%`;
}

export function closePositionModal() {
    document.getElementById('position-modal').style.display = 'none';
    onSaveCallback = null;
}

export async function savePosition() {
    if (onSaveCallback) {
        onSaveCallback(currentX, currentY);
    }
}


// Global
window.saveTextSettings = saveTextSettings;
window.openPositioning = openPositioning;
window.closePositionModal = closePositionModal;
window.savePosition = savePosition;
// Export for reuse
window.openGenericPositioning = openGenericPositioning;
