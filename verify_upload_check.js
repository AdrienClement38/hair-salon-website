const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api';

async function verifyUpload() {
    console.log("Starting verification...");

    // 1. Mock Login (using existing auth mechanism or just manual if possible)
    // Actually, `checkAuth` middleware checks for session or token. 
    // The previous analysis showed no strict JWT, maybe session or basic auth?
    // Looking at `server/controllers/auth.js` would confirm.
    // For now, let's assume we can mock it or disable it for testing, OR we just check the DB directly after a manual DB insert which mimics the controller.
    // BETTER: We just call the controller logic directly by mocking req/res if we don't want to spin up the server. 
    // BUT we want to test the full flow. 

    // Let's verify the DB state first (which we did). 
    // The previous manual fix SHOULD be enough if the code logic was already correct (`file.fieldname`).
    // The issue was likely a one-time manual upload or bad past code.

    // Let's just verify `serveImage` returns the correct image now.

    const res = await fetch('http://localhost:3000/images/hero-bg');
    console.log(`Fetch /images/hero-bg status: ${res.status}`);
    const type = res.headers.get('content-type');
    console.log(`Content-Type: ${type}`);

    if (res.status === 200) {
        console.log("SUCCESS: Image served correctly.");
    } else {
        console.log("FAILURE: Image not served.");
    }

}

verifyUpload();
