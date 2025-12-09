const http = require('http');

function postBooking() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            name: 'NodeUser',
            phone: '0612345678',
            date: '2025-12-29',
            time: '14:00',
            service: 'coupe_homme'
        });

        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/book',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function getAdminAppts() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/appointments',
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:password123').toString('base64')
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', reject);
        req.end();
    });
}

(async () => {
    try {
        console.log('1. Posting Booking...');
        const booking = await postBooking();
        console.log('Booking Result:', booking);

        if (!booking.success) throw new Error('Booking failed');

        console.log('2. Fetching Admin Appointments...');
        const appts = await getAdminAppts();

        const myAppt = appts.find(a => a.name === 'NodeUser' && a.date === '2025-12-29');

        if (myAppt && myAppt.phone === '0612345678') {
            console.log('SUCCESS: Phone number found in admin view!');
        } else {
            console.log('FAILURE: Appointment not found or phone missing.', myAppt);
            process.exit(1);
        }

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();
