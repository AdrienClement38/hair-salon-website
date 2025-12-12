const http = require('http');

function verify() {
    console.log("Verifying image...");
    http.get('http://localhost:3000/images/hero-bg', (res) => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);
        if (res.statusCode === 200) {
            console.log("SUCCESS");
        } else {
            console.log("FAILURE");
        }
    }).on('error', (e) => {
        console.error("Error:", e.message);
    });
}

verify();
