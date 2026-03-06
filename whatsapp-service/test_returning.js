const axios = require('axios');

const VENDOR_ID = '69820583c9486dbe5be440d4';
const PHONE_NUMBER = '83515957866586'; // Uday Kumar (Returning)
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
    // If customer has a pending order:
    //   'hi' -> shows active order menu (1=check status, 2=new order)
    //   '2'  -> place new order  -> goes to AWAITING_CAN_TYPE
    // If customer has NO pending order:
    //   'hi' -> goes directly to AWAITING_CAN_TYPE

    await send('hi');
    await new Promise(r => setTimeout(r, 1000));

    await send('2'); // Select "New Order" from the active order menu
    await new Promise(r => setTimeout(r, 1000));

    await send('20'); // 20L can type
    await new Promise(r => setTimeout(r, 1000));

    await send('1'); // 1 quantity
    await new Promise(r => setTimeout(r, 1000));

    await send('yes'); // Confirm order
}

run();
