// State
let pollInterval = null;
let displayedIds = new Set(); // Track what is currently on screen
const MAX_DISPLAY = 50; // New Limit

export async function loadPublicPortfolio() {
    const grid = document.getElementById('public-portfolio-grid');
    if (!grid) return;

    try {
        // Initial simple load: Fetch EVERYTHING
        const res = await fetch('/api/portfolio?t=' + Date.now());
        const items = await res.json();

        if (items.length === 0) {
            grid.innerHTML = '<p class="text-muted" style="text-align:center; grid-column: 1/-1;">Aucune photo pour le moment.</p>';
            return;
        }

        // Randomize Order (Only on initial load/refresh)
        shuffleArray(items);

        // Limit to MAX_DISPLAY (50)
        const displayItems = items.slice(0, MAX_DISPLAY);

        // Reset tracking
        displayedIds.clear();
        grid.innerHTML = '';

        // Render Limited items
        displayItems.forEach(item => {
            appendItem(item, grid);
            displayedIds.add(item.id);
        });

    } catch (e) {
        console.error("Error loading portfolio:", e);
    }
}

function appendItem(item, grid, prepend = false) {
    const div = document.createElement('div');
    div.className = 'masonry-item';
    div.innerHTML = `<img src="/images/${item.filename}" alt="Réalisation">`;
    div.dataset.id = item.id; // Store ID for easy removal

    if (prepend) {
        grid.prepend(div);
    } else {
        grid.appendChild(div);
    }
}

// WebSocket Portfolio Sync
export function startPortfolioPolling() {
    loadPublicPortfolio(); // Initial Load

    const socket = typeof io !== 'undefined' ? io() : null;
    if (socket) {
        socket.on('portfolioUpdated', async () => {
            console.log('Portfolio update received via WebSocket');

            // Smart Update: Fetch new IDs and append/remove appropriately
            try {
                const res = await fetch('/api/portfolio?format=ids');
                const serverIds = await res.json();

                // Find IDs that are NOT in our displayed set
                const newIds = serverIds.filter(id => !displayedIds.has(id));

                // Find IDs that were deleted from server
                const deletedIds = Array.from(displayedIds).filter(id => !serverIds.includes(id));
                const grid = document.getElementById('public-portfolio-grid');

                // Remove deleted
                if (deletedIds.length > 0 && grid) {
                    deletedIds.forEach(delId => {
                        const el = grid.querySelector(`.masonry-item[data-id="${delId}"]`);
                        if (el) el.remove();
                        displayedIds.delete(delId);
                    });
                }

                if (newIds.length > 0 && grid) {
                    // Fetch details for NEW items
                    const detailsRes = await fetch(`/api/portfolio?ids=${newIds.join(',')}`);
                    const newItems = await detailsRes.json();

                    // Prepend new items
                    newItems.forEach(item => {
                        if (!displayedIds.has(item.id)) {
                            appendItem(item, grid, true); // Prepend
                            displayedIds.add(item.id);
                        }
                    });

                    // Enforce Limit: Remove Oldest (Last in DOM)
                    const itemsInDom = grid.querySelectorAll('.masonry-item');
                    if (itemsInDom.length > MAX_DISPLAY) {
                        const excess = itemsInDom.length - MAX_DISPLAY;
                        for (let i = 0; i < excess; i++) {
                            const lastItem = grid.lastElementChild;
                            if (lastItem) {
                                const idToRemove = parseInt(lastItem.dataset.id);
                                displayedIds.delete(idToRemove);
                                grid.removeChild(lastItem);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("WebSocket check failed", e);
            }
        });
    }
}

export function stopPortfolioPolling() {
    // WebSockets persist or can be manually disconnected, but we just leave it active to keep data fresh implicitly.
}

// Utility: Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}



document.addEventListener('click', (e) => {
    if (e.target.matches('.masonry-item img')) {
        if (window.openLightbox) {
            window.openLightbox(e.target.src);
        }
    }
});
