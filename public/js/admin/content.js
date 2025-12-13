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
}

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
function initPositioning() {
    const img = document.getElementById('position-image');

    img.addEventListener('click', (e) => {
        const rect = img.getBoundingClientRect();
        // Calculate position relative to the image content, not the container borders if any
        // Since img object-fit is contain, we rely on click on img itself.

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Constraint within 0-100 to avoid edge cases
        let px = (x / rect.width) * 100;
        let py = (y / rect.height) * 100;

        px = Math.max(0, Math.min(100, px));
        py = Math.max(0, Math.min(100, py));

        currentX = Math.round(px * 10) / 10; // 1 decimal
        currentY = Math.round(py * 10) / 10;

        updateMarker();
    });
}

export function openPositioning(type) {
    currentPositioningImage = type === 'hero-bg' ? 'hero' : 'philosophy';

    // Load existing position if any
    const existing = currentPositioningImage === 'hero'
        ? currentHomeContent.heroPosition
        : currentHomeContent.philosophyPosition;

    if (existing) {
        currentX = existing.x;
        currentY = existing.y;
    } else {
        currentX = 50;
        currentY = 50;
    }

    const modal = document.getElementById('position-modal');
    const img = document.getElementById('position-image');

    // Use timestamp to break cache
    img.src = `/images/${type === 'hero-bg' ? 'hero-bg' : 'philosophy-bg'}?t=${Date.now()}`;

    updateMarker();
    modal.style.display = 'flex'; // Use flex to center with new CSS
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
}

export async function savePosition() {
    const key = currentPositioningImage === 'hero' ? 'heroPosition' : 'philosophyPosition';

    const settings = {
        home_content: {
            ...currentHomeContent,
            [key]: { x: currentX, y: currentY }
        }
    };

    try {
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        alert('Position enregistrée !');
        closePositionModal();
        // Update local state by reloading settings (could be cleaner but this works safely)
        // Since content.js doesn't import loadSettings easily without circular dep, we can just update local obj
        // But better to rely on dashboard refresh or simple reload if critical.
        // For now, updating currentHomeContent locally is enough for immediate saving consistency
        currentHomeContent[key] = { x: currentX, y: currentY };

    } catch (e) {
        alert('Erreur lors de la sauvegarde');
    }
}


// Global
window.saveTextSettings = saveTextSettings;
window.openPositioning = openPositioning;
window.closePositionModal = closePositionModal;
window.savePosition = savePosition;
