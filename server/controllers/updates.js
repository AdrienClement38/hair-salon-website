const { getUpdateStatus } = require('../config/polling');

exports.checkUpdates = (req, res) => {
    const clientSettings = parseInt(req.query.lastSettings) || 0;
    const clientAppt = parseInt(req.query.lastAppt) || 0;

    // console.log(`[Polling] Check - Client: ${clientAppt}, Server: ${require('../config/polling').getUpdateStatus().apptTimestamp}`);

    res.json(getUpdateStatus(clientSettings, clientAppt));
};
