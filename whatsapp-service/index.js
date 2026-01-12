const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001';

let sock = null;
let qrCode = null;
let isConnected = false;

async function initWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['HydroFlow', 'Chrome', '1.0.0']
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCode = qr;
                console.log('QR Code generated');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);

                if (shouldReconnect) {
                    setTimeout(initWhatsApp, 5000);
                }
                isConnected = false;
            } else if (connection === 'open') {
                console.log('WhatsApp connected successfully');
                qrCode = null;
                isConnected = true;
            }
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    if (!message.key.fromMe && message.message) {
                        await handleIncomingMessage(message);
                    }
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('WhatsApp initialization error:', error);
        setTimeout(initWhatsApp, 10000);
    }
}

async function handleIncomingMessage(message) {
    try {
        const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
        const messageText = message.message.conversation ||
                           message.message.extendedTextMessage?.text || '';

        console.log(`Received message from ${phoneNumber}: ${messageText}`);

        const response = await axios.post(`${FASTAPI_URL}/api/whatsapp/message`, {
            phone_number: phoneNumber,
            message: messageText,
            message_id: message.key.id,
            timestamp: message.messageTimestamp
        });

        if (response.data.reply) {
            await sendMessage(phoneNumber, response.data.reply);
        }

    } catch (error) {
        console.error('Error handling incoming message:', error);
    }
}

async function sendMessage(phoneNumber, text) {
    try {
        if (!sock) {
            throw new Error('WhatsApp not connected');
        }

        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text });
        console.log(`Sent message to ${phoneNumber}`);
        return { success: true };

    } catch (error) {
        console.error('Error sending message:', error);
        return { success: false, error: error.message };
    }
}

app.get('/qr', (req, res) => {
    res.json({ qr: qrCode || null });
});

app.post('/send', async (req, res) => {
    const { phone_number, message } = req.body;
    const result = await sendMessage(phone_number, message);
    res.json(result);
});

app.get('/status', (req, res) => {
    res.json({
        connected: isConnected && sock?.user ? true : false,
        user: sock?.user || null
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`WhatsApp service running on port ${PORT}`);
    initWhatsApp();
});
