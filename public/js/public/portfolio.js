// Polling ID
let pollInterval = null;

export async function loadPublicPortfolio() {
    const grid = document.getElementById('public-portfolio-grid');
    if (!grid) return;

    try {
        const res = await fetch('/api/portfolio?t=' + Date.now()); // Cache burst
        const items = await res.json();

        if (items.length === 0) {
            grid.innerHTML = '<p class="text-muted" style="text-align:center; grid-column: 1/-1;">Aucune photo pour le moment.</p>';
            return;
        }

        grid.innerHTML = items.map(item => `
            <div class="masonry-item">
                <img src="/images/${item.filename}" alt="Réalisation coiffure">
            </div>
        `).join('');
    } catch (e) {
        console.error("Error loading portfolio:", e);
        // Don't show error to user in polling mode to avoid flickering
    }
}

export function startPortfolioPolling() {
    if (pollInterval) return;
    loadPublicPortfolio(); // Initial
    pollInterval = setInterval(loadPublicPortfolio, 5000); // Poll every 5s
}

export function stopPortfolioPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}
