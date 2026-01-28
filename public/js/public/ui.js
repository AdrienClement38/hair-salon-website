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

    // Update UI state after render
    setTimeout(updateCarouselUI, 0);
}

function createItemCard(item, type) {
    let mediaHtml = '';

    if (type === 'service') {
        mediaHtml = `
            <div class="card-media icon ${item.icon}">
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

    const isService = type === 'service';
    const bodyContent = isService ? (item.duration ? `${item.duration} min` : '30 min') : (item.description || '');

    if (isService) {
        const duration = item.duration ? `${item.duration} min` : '30 min';
        return `
            <div class="item-card service-card">
                ${mediaHtml}
                <div class="card-header service-header">
                    <h3>${item.name}</h3>
                </div>
                <div class="service-footer">
                    <span class="price">${item.price}€</span>
                    <span class="service-duration">${duration}</span>
                </div>
            </div>
        `;
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
            // Check if break is valid/relevant (Break Start < Break End AND Break End < Close)
            // If Close is 13:00 and Break End is 14:00, break is invalid.
            const hasBreak = dayData.breakStart && dayData.breakEnd &&
                dayData.breakStart < dayData.breakEnd &&
                dayData.breakEnd < dayData.close;

            // Formatting helper
            const cleanTime = (t) => t;

            if (hasBreak) {
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

    // Attempt to merge Sunday (last) and Monday (first) if both are Closed
    if (groups.length > 1) {
        const first = groups[0];
        const last = groups[groups.length - 1];
        // Check if both are closed. First starts with Lun, Last ends with Dim.
        if (first.time === 'Fermé' && last.time === 'Fermé' && first.startDay === 'Lun' && last.endDay === 'Dim') {
            last.overrideLabel = "Dim & Lun";
            groups.shift(); // Remove Monday group
        }
    }

    let html = '';
    groups.forEach(g => {
        let label = g.overrideLabel || g.startDay;
        if (!g.overrideLabel && g.count > 1) {
            if (g.count > 2) label += ` - ${g.endDay}`;
            else if (g.count === 2) label += ` & ${g.endDay}`;
        }
        html += `<div><strong>${label} :</strong> ${g.time}</div>`;
    });

    container.innerHTML = html;
}

export function renderHomeContent(content, identity) {
    if (!content) return;

    const titleEl = document.getElementById('hero-title');
    const subtitleEl = document.getElementById('hero-subtitle');

    if (identity && identity.logo) {
        // Show Logo instead of Text
        if (titleEl) {
            titleEl.innerHTML = `<img src="/images/${identity.logo}?t=${Date.now()}" alt="${identity.name}" class="hero-logo">`;
            // Ensure no residual styles affect the image layout weirdly, though class handles most.
        }
        if (subtitleEl) subtitleEl.style.display = 'none';
    } else {
        // Show Text
        if (titleEl) {
            titleEl.textContent = content.title || 'Salon';
            // Restore default display if it was hidden (though h1 is block by default)
        }
        if (subtitleEl) {
            subtitleEl.textContent = content.subtitle || '';
            subtitleEl.style.display = 'block';
        }
    }

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

export function renderIdentity(identity) {
    const logoLink = document.getElementById('header-logo');
    if (!logoLink) return;

    if (!identity) {
        // Default
        logoLink.innerHTML = 'La Base Coiffure';
        return;
    }

    if (identity.logo) {
        // Logo + Name
        // We want the logo to be nicely integrated.
        // Maybe an img tag with height constraint.
        // CSS for .logo needs to handle flex or inline-block.
        // Current CSS for .logo is likely font-based.
        // Let's use flexbox for the link container or just inject img + text.
        logoLink.style.display = 'flex';
        logoLink.style.alignItems = 'center';
        logoLink.style.gap = '10px';

        logoLink.innerHTML = `
            <span>${identity.name}</span>
        `;
    } else {
        logoLink.style.display = ''; // Reset
        logoLink.style.alignItems = '';
        logoLink.style.gap = '';
        logoLink.innerHTML = identity.name || 'La Base Coiffure';
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
export function scrollCarousel(gridId, direction) {
    const container = document.getElementById(gridId);
    if (!container) return;

    // Scroll by card width + gap approx
    const scrollAmount = 260 * direction;
    container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
}

export function scrollProducts(direction) {
    scrollCarousel('products-grid', direction);
}

// UI State Update for Carousel
function updateCarouselUI() {
    ['products-grid', 'services-grid'].forEach(gridId => {
        const container = document.getElementById(gridId);
        // Find closest wrapper
        if (!container) return;
        const wrapper = container.closest('.carousel-wrapper');
        if (!wrapper) return;

        const prevBtn = wrapper.querySelector('.prev-btn');
        const nextBtn = wrapper.querySelector('.next-btn');

        // Check overflow
        const isOverflowing = container.scrollWidth > container.clientWidth + 1;

        if (isOverflowing) {
            container.style.justifyContent = 'flex-start';
            if (prevBtn) prevBtn.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'flex';
        } else {
            // Only center if NOT mobile? Mobile services are "display: block" vertical.
            // On desktop: display flex.
            // Check computed style?
            if (window.innerWidth > 768) {
                container.style.justifyContent = 'center';
            }
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        }
    });
}

// Ensure update is called when render finishes
const originalRenderServices = renderServices; // We are in the same module, circular ref?
// No, we export renderServices. We should call updateCarouselUI inside it.
// I will just rely on the existing setTimeout call in renderProducts and ADD one in renderServices.

// Lightbox Logic
window.openLightbox = (src, title, price, desc) => {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');

    if (!modal || !img) return;

    img.src = src;

    // User requested to show ONLY the photo, no text at all.
    caption.style.display = 'none';

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
window.scrollCarousel = scrollCarousel;
// Listen for resize
window.addEventListener('resize', updateCarouselUI);
export function updateEmailFieldVisibility(isConfigured) {
    const emailInput = document.getElementById('email');
    if (!emailInput) return;
    const formGroup = emailInput.closest('.form-group');
    if (formGroup) {
        if (isConfigured) {
            formGroup.style.display = 'block';
        } else {
            formGroup.style.display = 'none';
            emailInput.value = ''; // clear value if hidden
        }
    }
}
