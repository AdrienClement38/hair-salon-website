import { initBooking, refreshSlots, loadServices as refreshBookingServices, refreshBookingWorkers } from './booking.js';
import { renderOpeningHours, renderHolidays, renderHomeContent, renderServices, refreshImages, renderContactInfo, renderProducts, renderIdentity, updateEmailFieldVisibility } from './ui.js';
import { loadPublicPortfolio } from './portfolio.js';



// Mobile Menu Toggle
window.toggleMenu = function () {
    const navList = document.getElementById('nav-list');
    navList.classList.toggle('active');
}

let lastSettingsTS = Date.now();
let lastApptTS = Date.now();

// Poll Updates
async function pollUpdates() {
    try {
        const res = await fetch(`/api/updates?lastSettings=${lastSettingsTS}&lastAppt=${lastApptTS}`);
        const data = await res.json();

        if (data.needsSettingsUpdate) {
            console.log('Settings update detected');
            lastSettingsTS = data.settingsTimestamp;
            loadSettings();
            refreshBookingServices(); // Update booking dropdown
            refreshBookingWorkers(); // Update workers dropdown

            // Refresh Images
            refreshImages();
        }

        if (data.needsApptUpdate) {
            console.log('Appt update detected');
            lastApptTS = data.apptTimestamp;
            refreshSlots();
        }

    } catch (err) {
        console.warn('Polling error:', err);
    }
}

// Load Settings
async function loadSettings() {
    try {
        console.log("Fetching settings...");
        const res = await fetch(`/api/settings?t=${Date.now()}`);
        const { openingHours, holidayRanges, home_content, services, contact_info, products, salon_identity, emailConfigured } = await res.json();

        renderOpeningHours(openingHours);
        renderHolidays(holidayRanges);
        renderHomeContent(home_content, salon_identity);
        renderServices(services);
        renderContactInfo(contact_info);
        renderProducts(products);
        renderIdentity(salon_identity);
        updateEmailFieldVisibility(emailConfigured);


    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initBooking();
    loadSettings();

    // Start polling
    setInterval(pollUpdates, 5000);

    // Expose navigation
    window.showPortfolio = () => {
        // Hide all main sections
        document.querySelectorAll('section.hero, section.section').forEach(el => el.style.display = 'none');
        document.getElementById('portfolio-section').style.display = 'block';

        // Start polling
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
    document.querySelectorAll('.nav-list a, .logo, .btn[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // If it's a specific section anchor (not just # or portfolio trigger), assume "Home" context
            if (href && href.startsWith('#')) {
                // Ignore if it's the portfolio trigger
                if (link.getAttribute('onclick') && link.getAttribute('onclick').includes('showPortfolio')) return;

                // Handle Home Link (#) specifically for smooth/no-jump
                if (href === '#') {
                    e.preventDefault();
                    window.showHome();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    // Clean URL if it has # (optional, keeps it clean like image 1)
                    if (window.location.hash) {
                        history.pushState(null, null, ' ');
                    }
                    return;
                }

                window.showHome();
                // Allow default behavior for smooth scroll
            }
        });
    });

    // Check initial hash
    if (window.location.hash === '#portfolio') {
        window.showPortfolio();
    } else {
        // Ensure home is clearly visible by default logic
    }
});
