const { initPromise, deleteLeave, getAllLeaves, deleteAppointment, getAllAppointments, type } = require('../server/models/database');

(async () => {
    try {
        console.log('Starting test data cleanup...');
        await initPromise;

        let deletedCount = 0;

        // 1. Cleanup Leaves
        const leaves = await getAllLeaves();
        const testLeaves = leaves.filter(l =>
            l.note === 'Test Leave' ||
            (l.admin_id !== null && l.username === null && l.note && l.note.includes('Test'))
        );

        for (const l of testLeaves) {
            console.log(`Deleting Test Leave ID: ${l.id} (Note: ${l.note})`);
            await deleteLeave(l.id);
            deletedCount++;
        }

        // 2. Cleanup Appointments
        // Assuming test appointments might have specific names or be older than a certain date if they are from a "previous session"
        // But for now, let's target specific "Test" patterns if we use them in tests.
        // If tests don't mark their data, we can't safely delete it. 
        // We will assume future tests will use 'Test' prefix or similar.

        const appointments = await getAllAppointments();
        const testAppointments = appointments.filter(a =>
            a.name && (a.name.startsWith('Test Appt') || a.name === 'Test User')
        );

        for (const a of testAppointments) {
            console.log(`Deleting Test Appointment ID: ${a.id} (Name: ${a.name})`);
            await deleteAppointment(a.id);
            deletedCount++;
        }

        if (deletedCount > 0) {
            console.log(`Cleanup complete. Removed ${deletedCount} test artifacts.`);
        } else {
            console.log('Database is clean. No test artifacts found.');
        }

        // Force exit because db connection might keep process alive
        process.exit(0);

    } catch (e) {
        console.error('Cleanup failed:', e);
        process.exit(1);
    }
})();
