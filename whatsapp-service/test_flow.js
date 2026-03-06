const axios = require('axios');

const VENDOR_ID = '69820583c9486dbe5be440d4';
const PHONE_NUMBER = '918848961410'; // Using the number from user logs
const API_KEY = 'thanni-canuuu-service-api-key-d4e6f1b9a0c5d7e3f2';
const SIMULATE_URL = `http://localhost:3001/test/simulate-message/${VENDOR_ID}`;

async function send(text) {
    console.log(`\n> Sending: "${text}"`);
    try {
        const res = await axios.post(SIMULATE_URL, {
            from: PHONE_NUMBER,
            text: text
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log(`< Response code: ${res.status}`);
        return res.data;
    } catch (e) {
        console.error(`< Error: ${e.response?.data?.error || e.message}`);
    }
}

async function run() {
    const timestamp = new Date().toISOString().substring(11, 19);
    await send('hi');
    await new Promise(r => setTimeout(r, 1000));

    await send('1'); // Tamil
    await new Promise(r => setTimeout(r, 1000));

    await send('Test User ' + timestamp); // Name
    await new Promise(r => setTimeout(r, 1000));

    await send('123 Test Street, ' + timestamp); // Address
    await new Promise(r => setTimeout(r, 1000));

    await send('20'); // 20L
    await new Promise(r => setTimeout(r, 1000));

    await send('1'); // 1 quantity
    await new Promise(r => setTimeout(r, 1000));

    await send('yes'); // Confirm
}

run();
