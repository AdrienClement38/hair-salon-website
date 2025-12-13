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

    container.innerHTML = services.map(svc => `
        <div class="card">
            <div class="card-icon" style="color:var(--gold); display:flex; justify-content:center; align-items:center; height:50px;">${svgs[svc.icon] || svgs.star}</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:15px;">
                 <h3 style="margin:0; text-align:left; line-height:1.2;">${svc.name}</h3>
                 <span style="font-weight:bold; color:var(--gold); flex-shrink:0; white-space:nowrap;">${svc.price}€</span>
            </div>
            ${svc.description ? `<p style="font-size:0.9em; color:#ddd; margin-top:5px;">${svc.description}</p>` : ''}
        </div>
    `).join('');
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
            if (g.count > 2) label += ` - ${g.endDay}`;
            else if (g.count === 2) label += `, ${g.endDay}`;
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
