import { initBooking, refreshSlots, loadServices as refreshBookingServices, refreshBookingWorkers } from './booking.js';
import { renderOpeningHours, renderHolidays, renderHomeContent, renderServices, refreshImages, renderContactInfo, renderProducts, renderIdentity, updateEmailFieldVisibility, renderLoyaltyProgram } from './ui.js';
import { loadPublicPortfolio } from './portfolio.js';



// Mobile Menu Toggle
window.toggleMenu = function () {
    const navList = document.getElementById('nav-list');
    navList.classList.toggle('active');
}

// Load Settings
async function loadSettings() {
    try {
        console.log("Fetching settings...");
        const res = await fetch(`/api/settings?t=${Date.now()}`);
        const { openingHours, holidayRanges, home_content, services, contact_info, products, salon_identity, emailConfigured, loyalty_program } = await res.json();

        renderOpeningHours(openingHours);
        renderHolidays(holidayRanges);
        renderHomeContent(home_content, salon_identity);
        renderServices(services);
        renderContactInfo(contact_info);
        renderProducts(products);
        renderIdentity(salon_identity);
        updateEmailFieldVisibility(emailConfigured);
        renderLoyaltyProgram(loyalty_program);


    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initBooking();
    loadSettings();

    // Setup WebSockets
    const socket = typeof io !== 'undefined' ? io() : null;
    if (socket) {
        socket.on('settingsUpdated', () => {
            console.log('Settings update received via WebSocket');
            loadSettings();
            refreshBookingServices();
            refreshBookingWorkers();
            refreshImages();
        });

        socket.on('appointmentsUpdated', () => {
            console.log('Appointments update received via WebSocket');
            refreshSlots();
        });
    }

    // Expose navigation
    window.showPortfolio = () => {
        // Hide all main sections
        document.querySelectorAll('section.hero, section.section').forEach(el => el.style.display = 'none');
        document.getElementById('portfolio-section').style.display = 'block';

        // Start polling (Leave as is for now or migrate if needed)
        import('./portfolio.js').then(m => m.startPortfolioPolling());

        window.scrollTo(0, 0);
        history.pushState(null, null, '#portfolio');
    };

    window.showHome = () => {
        document.getElementById('portfolio-section').style.display = 'none';

        // Stop polling
        import('./portfolio.js').then(m => m.stopPortfolioPolling());

        document.querySelectorAll('section.hero, section.section').forEach(el => {
            if (el.id !== 'portfolio-section') el.style.display = '';
        });
        // Remove hash or set to home? Better remove to look clean or set to #
        if (window.location.hash === '#portfolio') {
            history.pushState(null, null, ' '); // Clear hash
        }
    };
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const navList = document.getElementById('nav-list');
        const hamburger = document.querySelector('.hamburger-menu');

        if (navList.classList.contains('active') &&
            !navList.contains(e.target) &&
            !hamburger.contains(e.target)) {
            navList.classList.remove('active');
        }
    });

    // Navigation Logic
    // Global listener for other # links to ensure showHome is called
    document.querySelectorAll('.nav-list a[href^="#"], .logo, .btn[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            // IGNORE the "Notre Travail" link completely here
            const onclick = link.getAttribute('onclick');
            if (onclick && onclick.includes('showPortfolio')) return;

            window.showHome();
        });
    });

    // Check initial hash
    if (window.location.hash === '#portfolio') {
        window.showPortfolio();
    } else {
        window.showHome();
    }
});
