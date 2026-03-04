const fs = require('fs');
try {
    const text = fs.readFileSync('debug_jest.txt', 'utf16le');
    const startFail = text.indexOf('FAIL tests/images_cleanup.test.js');
    if (startFail !== -1) {
        console.log(text.substring(startFail, startFail + 2000));
    } else {
        console.log("No FAIL found in log");
        console.log(text.substring(0, 1000));
    }
} catch (e) {
    console.error(e);
}
