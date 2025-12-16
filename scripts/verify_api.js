const http = require('http');

function check(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

(async () => {
    try {
        // Test a likely closed date or just generic
        // 2025-01-01 is a holiday usually
        const url = 'http://localhost:3000/api/slots?date=2025-01-01';
        console.log(`Checking ${url}...`);
        const data = await check(url);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data.reason && Array.isArray(data.slots)) {
            console.log('✅ Structure is correct: { slots, reason }');
        } else {
            console.error('❌ Structure is incorrect');
            process.exit(1);
        }
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
