// public/js/public/ui.js
import { svgs } from './config.js';

const messageBox = document.getElementById('form-message');

export function renderServices(services) {
    const container = document.getElementById('services-grid');
    if (!container) return;

    if (!services || services.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Aucune prestation disponible pour le moment.</p>';
        return;
    }

    container.innerHTML = services.map(svc => createItemCard(svc, 'service')).join('');
}

function createItemCard(item, type) {
    let mediaHtml = '';

    if (type === 'service') {
        mediaHtml = `
            <div class="card-media icon">
                ${svgs[item.icon] || svgs.star}
            </div>`;
    } else if (type === 'product') {
        const safeName = item.name.replace(/'/g, "\\'");
        const safeDesc = (item.description || '').replace(/'/g, "\\'");

        if (item.image) {
            mediaHtml = `
                <div class="card-media image" 
                     onclick="openLightbox('/images/${item.image}', '${safeName}', '${item.price}', '${safeDesc}')">
                    <img src="/images/${item.image}" alt="${item.name}" 
                         style="${item.imagePosition ? `object-position: ${item.imagePosition.x}% ${item.imagePosition.y}%;` : ''}">
                </div>`;
        } else {
            mediaHtml = `<div class="card-media image" style="background:#333; cursor:default;"><span style="color:#666;">Pas d'image</span></div>`;
        }
    }

    return `
        <div class="item-card">
            ${mediaHtml}
            <div class="card-header">
                <h3>${item.name}</h3>
                <span class="price">${item.price}€</span>
            </div>
            <p class="card-body">${item.description || ''}</p>
        </div>
    `;
}

export function renderHolidays(ranges) {
    const container = document.getElementById('holiday-display');
    if (!container) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const activeRanges = (ranges || []).filter(r => {
        const end = new Date(r.end);
        return end >= now;
    }).sort((a, b) => new Date(a.start) - new Date(b.start));

    if (activeRanges.length === 0) {
        container.innerHTML = '';
        return;
    }

    const html = activeRanges.map(r => {
        const start = new Date(r.start).toLocaleDateString('fr-FR');
        const end = new Date(r.end).toLocaleDateString('fr-FR');
        return `<div>Congés du ${start} au ${end}</div>`;
    }).join('');

    container.innerHTML = html;
}

export function renderOpeningHours(openingHours) {
    const container = document.getElementById('opening-hours-display');
    if (!container) return;

    if (!openingHours) {
        container.innerHTML = '';
        return;
    }

    let schedule = [];
    if (Array.isArray(openingHours)) {
        schedule = openingHours;
    } else {
        const start = openingHours.start || '09:00';
        const end = openingHours.end || '18:00';
        const closed = openingHours.closedDays || [];
        for (let i = 0; i < 7; i++) {
            schedule[i] = { open: start, close: end, isOpen: !closed.includes(i) };
        }
    }

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const groups = [];
    const uiOrder = [1, 2, 3, 4, 5, 6, 0];
    let currentGroup = null;

    uiOrder.forEach(dayIdx => {
        const dayData = schedule[dayIdx] || { isOpen: false };
        const dayLabel = dayNames[dayIdx];

        let timeStr = 'Fermé';
        if (dayData.isOpen) {
            if (dayData.breakStart && dayData.breakEnd) {
                // Formatting helper
                const cleanTime = (t) => t; // Or trim seconds if needed
                timeStr = `${cleanTime(dayData.open)} - ${cleanTime(dayData.breakStart)} / ${cleanTime(dayData.breakEnd)} - ${cleanTime(dayData.close)}`;
            } else {
                timeStr = `${dayData.open} - ${dayData.close}`;
            }
        }

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
            if (g.count > 2) label += ` - ${g.endDay}`; // e.g. Lun - Mer
            else if (g.count === 2) label += ` & ${g.endDay}`; // e.g. Jeu & Ven (Wait, standard is usually comma or just range if contiguous)
            // Let's stick to simple logic: Contiguous days usually use " - ".
            // But here we rely on the loop order, so if they are contiguous in uiOrder, they are contiguous days.
        }
        html += `<div><strong>${label} :</strong> ${g.time}</div>`;
    });

    container.innerHTML = html;
}

export function renderHomeContent(content) {
    if (!content) return;

    if (content.title) document.getElementById('hero-title').textContent = content.title;
    if (content.subtitle) document.getElementById('hero-subtitle').textContent = content.subtitle;
    if (content.philosophy && document.getElementById('philosophy-text')) {
        const pTags = content.philosophy.split('\n').filter(line => line.trim() !== '').map(line => `<p>${line}</p>`).join('');
        document.getElementById('philosophy-text').innerHTML = pTags;
    }

    // Apply positions
    if (content.heroPosition) {
        const hero = document.querySelector('.hero');
        if (hero) hero.style.backgroundPosition = `${content.heroPosition.x}% ${content.heroPosition.y}%`;
    }

    if (content.philosophyPosition) {
        const philBg = document.getElementById('philosophy-bg');
        if (philBg) {
            philBg.style.backgroundPosition = `${content.philosophyPosition.x}% ${content.philosophyPosition.y}%`;
        }
    }
}

export function showMessage(msg, type) {
    messageBox.style.color = type === 'success' ? 'green' : 'red';
    messageBox.innerHTML = msg;
}

export function refreshImages() {
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('/images/hero-bg?t=${Date.now()}')`;
    }
    const phil = document.getElementById('philosophy-bg');
    if (phil) {
        phil.style.backgroundImage = `url('/images/philosophy-bg?t=${Date.now()}')`;
    }
}

export function renderContactInfo(info) {
    const footerEl = document.getElementById('contact-footer');
    if (!footerEl) return;

    // Default valid info object check
    if (info && (info.address || info.phone)) {
        footerEl.textContent = `${info.address || ''} | ${info.phone || ''}`;
    }
}

export function renderProducts(products) {
    const container = document.getElementById('products-grid');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Aucun produit disponible pour le moment.</p>';
        return;
    }

    container.innerHTML = products.map(prod => createItemCard(prod, 'product')).join('');

    // Update UI state after render
    setTimeout(updateCarouselUI, 0);
}

// Carousel Logic
export function scrollProducts(direction) {
    const container = document.getElementById('products-grid');
    if (!container) return;

    // Scroll by card width + gap approx
    const scrollAmount = 260 * direction;
    container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
}

// UI State Update for Carousel
function updateCarouselUI() {
    const container = document.getElementById('products-grid');
    const wrapper = document.querySelector('.carousel-wrapper');
    if (!container || !wrapper) return;

    const prevBtn = wrapper.querySelector('.prev-btn');
    const nextBtn = wrapper.querySelector('.next-btn');

    // Check overflow
    // Allow a small buffer (1px) for rounding errors
    const isOverflowing = container.scrollWidth > container.clientWidth + 1;

    if (isOverflowing) {
        container.style.justifyContent = 'flex-start';
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
    } else {
        container.style.justifyContent = 'center';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
}

// Lightbox Logic
window.openLightbox = (src, title, price, desc) => {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');

    if (!modal || !img) return;

    img.src = src;

    if (title || price) {
        caption.style.display = 'block';
        document.getElementById('lightbox-title').textContent = title || '';
        document.getElementById('lightbox-price').textContent = price ? price + '€' : '';
        document.getElementById('lightbox-desc').textContent = desc || '';
    } else {
        caption.style.display = 'none';
    }

    modal.classList.add('active');
};

// Close Lightbox
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('lightbox-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
});


// Expose to window for onclick
window.scrollProducts = scrollProducts;
// Listen for resize
window.addEventListener('resize', updateCarouselUI);
