const http = require('http');

const login = (username, password) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ username, password });
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
};

async function test() {
    console.log("Testing Rate Limit...");

    // 1. Fail 5 times
    for (let i = 1; i <= 5; i++) {
        const res = await login('admin', 'wrongpass');
        console.log(`Attempt ${i} (Fail): Status ${res.status}`);
    }

    // 2. 6th attempt (Fail) -> Should be 429
    const resBlocked = await login('admin', 'wrongpass');
    console.log(`Attempt 6 (blocked): Status ${resBlocked.status}`);
    console.log(`Body: ${resBlocked.body}`);

    if (resBlocked.status === 429 && resBlocked.body.includes('Trop de tentatives')) {
        console.log("SUCCESS: Rate limit triggered.");
    } else {
        console.log("FAILURE: Rate limit NOT triggered.");
    }
}

// We need to wait for server restart first, so maybe run this manually?
// Just defining it for now.
test().catch(console.error);
