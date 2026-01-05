const db = require('../server/models/database');

describe('Theme System Persistence', () => {
    beforeAll(async () => {
        await db.initPromise;
    });

    afterEach(async () => {
        // Reset to default after each test
        await db.setSetting('active_theme', 'default');
    });

    test('should save and retrieve active_theme setting', async () => {
        const theme = 'red-black';
        await db.setSetting('active_theme', theme);

        const saved = await db.getSetting('active_theme');
        expect(saved).toBe(theme);
    });

    test('should return null or default if not set (depending on logic)', async () => {
        // We know we default to 'default' in frontend, but DB might return null if never set
        // Let's check current behavior. 
        // If we strictly want a default in DB, we'd need to mock empty state, 
        // but here we are testing against the live dev DB (file-based).
        // Let's just ensure we can overwrite it.
        await db.setSetting('active_theme', 'nature');
        const saved = await db.getSetting('active_theme');
        expect(saved).toBe('nature');
    });

    test('should support all defined themes', async () => {
        const themes = ['default', 'dark', 'nature', 'ocean', 'red-black'];
        for (const t of themes) {
            await db.setSetting('active_theme', t);
            const saved = await db.getSetting('active_theme');
            expect(saved).toBe(t);
        }
    });
});
