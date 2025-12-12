let lastSettingsUpdate = Date.now();
let lastAppointmentsUpdate = Date.now();

exports.triggerUpdate = (type = 'appointments') => {
    if (type === 'settings') {
        lastSettingsUpdate = Date.now();
        console.log(`[Polling] Settings updated at ${lastSettingsUpdate}`);
    } else {
        lastAppointmentsUpdate = Date.now();
        console.log(`[Polling] Appointments updated at ${lastAppointmentsUpdate}`);
    }
};

exports.getUpdateStatus = (clientSettingsTS = 0, clientApptTS = 0) => {
    return {
        needsSettingsUpdate: lastSettingsUpdate > clientSettingsTS,
        needsApptUpdate: lastAppointmentsUpdate > clientApptTS,
        settingsTimestamp: lastSettingsUpdate,
        apptTimestamp: lastAppointmentsUpdate
    };
};
