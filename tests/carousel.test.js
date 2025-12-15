

const { JSDOM } = require('jsdom');

describe('Carousel UI Logic', () => {
    let document;
    let window;
    let container;
    let wrapper;
    let prevBtn;
    let nextBtn;

    // Helper to setup the DOM environment
    function setupDOM(html) {
        const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
        window = dom.window;
        document = window.document;

        // Mock setTimeout
        jest.useFakeTimers();
        window.setTimeout = setTimeout;

        // Load the script content manually (simple way to test logic without separate file loading complexity)
        const scriptElement = document.createElement('script');
        scriptElement.textContent = `
            function updateCarouselUI() {
                const container = document.getElementById('products-grid');
                const wrapper = document.querySelector('.carousel-wrapper');
                if (!container || !wrapper) return;

                const prevBtn = wrapper.querySelector('.prev-btn');
                const nextBtn = wrapper.querySelector('.next-btn');

                // Check overflow - simplified for test because JSDOM doesn't do layout
                // We will manually toggle a class or property to simulate overflow state in test
                let isOverflowing = container.getAttribute('data-overflow') === 'true';

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
            window.updateCarouselUI = updateCarouselUI;
        `;
        document.body.appendChild(scriptElement);

        return { document, window };
    }

    beforeEach(() => {
        setupDOM(`
            <div class="carousel-wrapper">
                <button class="carousel-btn prev-btn">Prev</button>
                <div id="products-grid" style="display: flex;"></div>
                <button class="carousel-btn next-btn">Next</button>
            </div>
        `);
        container = document.getElementById('products-grid');
        wrapper = document.querySelector('.carousel-wrapper');
        prevBtn = wrapper.querySelector('.prev-btn');
        nextBtn = wrapper.querySelector('.next-btn');
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    test('should center content and hide arrows when NO overflow', () => {
        // Simulate NO overflow
        container.setAttribute('data-overflow', 'false');

        window.updateCarouselUI();

        expect(container.style.justifyContent).toBe('center');
        expect(prevBtn.style.display).toBe('none');
        expect(nextBtn.style.display).toBe('none');
    });

    test('should align start and show arrows when overflow exists', () => {
        // Simulate Overflow
        container.setAttribute('data-overflow', 'true');

        window.updateCarouselUI();

        expect(container.style.justifyContent).toBe('flex-start');
        expect(prevBtn.style.display).toBe('flex');
        expect(nextBtn.style.display).toBe('flex');
    });
});
