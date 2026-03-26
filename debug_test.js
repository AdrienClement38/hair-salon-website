const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.log(`[BROWSER ERROR] ${err.toString()}`);
    });

    try {
        console.log('Navigating to http://localhost:3000...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        console.log('Clicking "Notre Travail"...');
        // Find link with Notre Travail
        const link = await page.waitForSelector('xpath///a[contains(text(), "Notre Travail")]');
        await link.click();
        
        console.log('Waiting for #portfolio-section display...');
        await page.waitForFunction(() => {
            const p = document.getElementById('portfolio-section');
            return p && getComputedStyle(p).display === 'block';
        }, { timeout: 10000 });
        
        console.log('SUCCESS: Portfolio visible');
    } catch (e) {
        console.log('FAILED:', e.message);
    } finally {
        await browser.close();
    }
})();
