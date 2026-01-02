const nodemailer = require('nodemailer');
const db = require('../server/models/database');

async function debugEmail() {
    console.log('--- Starting Email Diagnostic ---');

    await db.initPromise;
    const configVal = await db.getSetting('email_config');

    if (!configVal) {
        console.error('❌ No email configuration found in DB (email_config is null).');
        process.exit(1);
    }

    let config;
    try {
        config = typeof configVal === 'string' ? JSON.parse(configVal) : configVal;
        console.log('✅ Configuration loaded from DB.');
        console.log(`User: ${config.user}`);
        console.log(`Host: ${config.host || 'smtp.gmail.com (Default)'}`);
        console.log(`Port: ${config.port || '465 (Default)'}`);
    } catch (e) {
        console.error('❌ Failed to parse config JSON:', e.message);
        process.exit(1);
    }

    // Test 1: Standard Config (as recently updated)
    await runTest('Test 1: Standard Config (TLS relaxed)', {
        host: config.host || 'smtp.gmail.com',
        port: config.port || 465,
        secure: (config.port || 465) == 465,
        auth: { user: config.user, pass: config.pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        debug: true, // Enable debug logs
        logger: true
    });

    // Test 2: IPv4 Forced
    await runTest('Test 2: Forced IPv4', {
        host: config.host || 'smtp.gmail.com',
        port: config.port || 465,
        secure: (config.port || 465) == 465,
        auth: { user: config.user, pass: config.pass },
        tls: { rejectUnauthorized: false },
        family: 4, // Force IPv4
        connectionTimeout: 10000
    });
}

async function runTest(name, transportConfig) {
    console.log(`\n--- Running ${name} ---`);
    const transporter = nodemailer.createTransport(transportConfig);

    try {
        await transporter.verify();
        console.log(`✅ ${name}: SUCCESS! The connection is working.`);
    } catch (error) {
        console.error(`❌ ${name}: FAILED.`);
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        if (error.command) console.error('Last Command:', error.command);
    }
}

debugEmail().catch(err => console.error('Script Error:', err));
