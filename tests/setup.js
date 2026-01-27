// tests/setup.js
// This file runs before each test suite

// We might want to clear the DB before/after each test here if needed.
// Since we use :memory:, mostly just creating tables is handled by app start (model init).

// Suppress console logs during tests to keep output clean, optionally


const db = require('../server/models/database');

beforeAll(async () => {
    // Ensure DB is initialized before tests start to avoid race conditions (logging after teardown)
    try {
        await db.initPromise;
    } catch (e) {
        console.error('Failed to initialize DB in setup:', e);
    }
});
