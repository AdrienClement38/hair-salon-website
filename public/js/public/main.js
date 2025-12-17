import { initBooking, refreshSlots, loadServices as refreshBookingServices, refreshBookingWorkers } from './booking.js';
import { renderOpeningHours, renderHolidays, renderHomeContent, renderServices, refreshImages, renderContactInfo, renderProducts } from './ui.js';
import { loadPublicPortfolio } from './portfolio.js';


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
        const res = await fetch(`/api/settings`);
        const { openingHours, holidayRanges, home_content, services, contact_info, products } = await res.json();

        renderOpeningHours(openingHours);
        renderHolidays(holidayRanges);
        renderHomeContent(home_content);
        renderServices(services);
        renderContactInfo(contact_info);
        renderProducts(products);

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
            if (el.id !== 'portfolio-section') el.style.display = 'block';
        });
        // Remove hash or set to home? Better remove to look clean or set to #
        if (window.location.hash === '#portfolio') {
            history.pushState(null, null, ' '); // Clear hash
        }
    };
    // Navigation Logic
    // Navigation Logic
    document.querySelectorAll('.nav-list a, .logo, .btn[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // If it's a specific section anchor (not just # or portfolio trigger), assume "Home" context
            if (href && href.startsWith('#') && href !== '#' && !link.onclick) {
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
