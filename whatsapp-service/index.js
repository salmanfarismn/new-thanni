const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const PORT = process.env.PORT || 3001;

let sock = null;
let qrCode = null;
let isConnected = false;

// Simple in-memory conversation state
const state = new Map();

const STEPS = {
    START: 'START',
    AWAITING_NAME: 'AWAITING_NAME',
    AWAITING_ADDRESS: 'AWAITING_ADDRESS',
    AWAITING_CANS: 'AWAITING_CANS',
    CONFIRMATION: 'CONFIRMATION'
};

async function initWhatsApp() {
    try {
        const { state: authState, saveCreds } = await useMultiFileAuthState('auth_info');

        sock = makeWASocket({
            auth: authState,
            printQRInTerminal: false,
            browser: ['HydroFlow', 'Chrome', '1.0.0']
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            console.log('Connection Update:', { connection, hasQr: !!qr });

            if (qr) {
                qrCode = qr;
                console.log('\n--- WHATSAPP QR CODE ---');
                qrcode.generate(qr, { small: true });
                console.log('Scan the QR code above with your WhatsApp app.\n');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);

                if (shouldReconnect) {
                    console.log('Attempting to reconnect in 5 seconds...');
                    setTimeout(initWhatsApp, 5000);
                }
                isConnected = false;
                qrCode = null;
            } else if (connection === 'open') {
                console.log('\n✅ WhatsApp connected successfully!');
                console.log('User ID:', sock.user?.id);
                console.log('User Name:', sock.user?.name);
                qrCode = null;
                isConnected = true;
            } else if (update.receivedPendingNotifications) {

                console.log('Received pending notifications, connection is fully ready.');
                isConnected = true;
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            console.log('Messages Upsert:', JSON.stringify(m, null, 2).substring(0, 200) + '...');
            const { messages, type } = m;
            if (type === 'notify') {
                for (const message of messages) {
                    if (!message.key.fromMe && message.message) {
                        console.log('Processing incoming message from:', message.key.remoteJid);
                        await handleIncomingMessage(message);
                    }
                }
            }
        });

        sock.ev.on('creds.update', () => {
            console.log('Credentials updated and saved.');
            saveCreds();
        });

    } catch (error) {
        console.error('WhatsApp initialization error:', error);
        setTimeout(initWhatsApp, 10000);
    }
}

async function handleIncomingMessage(message) {
    try {
        const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
        const msgContent = message.message;

        // Comprehensive message text extraction
        const messageText = (
            msgContent.conversation ||
            msgContent.extendedTextMessage?.text ||
            msgContent.buttonsResponseMessage?.selectedButtonId ||
            msgContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
            msgContent.templateButtonReplyMessage?.selectedId ||
            ''
        ).trim();

        console.log(`[Bot] From ${phoneNumber}: "${messageText}"`);
        if (!messageText) {
            console.log('[Bot] Unsupported message type, ignoring.');
            return;
        }

        // Get or initialize state
        let userState = state.get(phoneNumber) || { step: STEPS.START };
        console.log(`[Bot] User ${phoneNumber} is at step ${userState.step}`);


        switch (userState.step) {
            case STEPS.START:
                userState.step = STEPS.AWAITING_NAME;
                state.set(phoneNumber, userState);
                await sendMessage(phoneNumber, "Welcome to HydroFlow! 💧\nPlease enter your *Name* to start your order:");
                break;

            case STEPS.AWAITING_NAME:
                if (messageText.length < 1) {
                    await sendMessage(phoneNumber, "Please provide a valid name.");
                } else {
                    userState.name = messageText;
                    userState.step = STEPS.AWAITING_ADDRESS;
                    state.set(phoneNumber, userState);
                    await sendMessage(phoneNumber, `Nice to meet you, ${messageText}! 🤝\nNow, please provide your *Delivery Address* (at least 6 characters):`);
                }
                break;

            case STEPS.AWAITING_ADDRESS:
                if (messageText.length <= 5) {
                    await sendMessage(phoneNumber, "The address is too short. Please provide a full address (min 6 characters):");
                } else {
                    userState.address = messageText;
                    userState.step = STEPS.AWAITING_CANS;
                    state.set(phoneNumber, userState);
                    await sendMessage(phoneNumber, "Great! Now, how many *Water Cans* (20L) would you like to order?\n(Enter a positive number):");
                }
                break;

            case STEPS.AWAITING_CANS:
                const quantity = parseInt(messageText);
                if (isNaN(quantity) || quantity <= 0) {
                    await sendMessage(phoneNumber, "Please enter a valid positive number for the quantity:");
                } else {
                    userState.quantity = quantity;
                    userState.step = STEPS.CONFIRMATION;
                    state.set(phoneNumber, userState);

                    const summary = `*Order Summary:*\n👤 Name: ${userState.name}\n📍 Address: ${userState.address}\n📦 Quantity: ${userState.quantity} cans\n\nReply with *YES* to confirm or *NO* to restart.`;
                    await sendMessage(phoneNumber, summary);
                }
                break;

            case STEPS.CONFIRMATION:
                if (messageText.toUpperCase() === 'YES') {
                    await sendMessage(phoneNumber, "Processing your order... ⏳");
                    try {
                        const response = await axios.post(`${FASTAPI_URL}/api/orders`, {
                            customer_phone: phoneNumber,
                            customer_name: userState.name,
                            customer_address: userState.address,
                            litre_size: 20, // Default to 20L as per request requirements
                            quantity: userState.quantity
                        });

                        if (response.data.success) {
                            await sendMessage(phoneNumber, `✅ *Order Confirmed!*\nOrder ID: ${response.data.order_id}\nDelivery by: ${response.data.delivery_staff}\n\nYour water will be delivered soon! 💧`);
                            state.delete(phoneNumber);
                        } else {
                            throw new Error('Backend failed to confirm order');
                        }
                    } catch (error) {
                        console.error('Order creation error:', error.response?.data || error.message);
                        const errorMsg = error.response?.data?.detail || "Something went wrong while processing your order.";
                        await sendMessage(phoneNumber, `❌ Sorry, I couldn't place your order: ${errorMsg}\nPlease try again later.`);
                        state.delete(phoneNumber);
                    }
                } else if (messageText.toUpperCase() === 'NO') {
                    state.delete(phoneNumber);
                    await sendMessage(phoneNumber, "Order cancelled. Send any message to start again.");
                } else {
                    await sendMessage(phoneNumber, "Please reply with *YES* or *NO*.");
                }
                break;

            default:
                state.delete(phoneNumber);
                await sendMessage(phoneNumber, "Session reset. Send any message to start again.");
                break;
        }

    } catch (error) {
        console.error('Error handling incoming message:', error.message);
    }
}

async function sendMessage(phoneNumber, text) {
    try {
        if (!sock) {
            throw new Error('WhatsApp not connected');
        }

        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text });
        console.log(`Sent message to ${phoneNumber}: ${text.substring(0, 30)}...`);
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
    // If we have sock.user, we are definitely connected
    const connected = isConnected || (sock?.user ? true : false);
    res.json({
        connected: connected,
        user: sock?.user || null,
        status: connected ? 'online' : (qrCode ? 'awaiting_scan' : 'connecting')
    });
});



app.post('/disconnect', async (req, res) => {
    try {
        console.log('Disconnect request received');

        if (sock) {
            try {
                await sock.logout();
                console.log('WhatsApp logout successful');
            } catch (logoutError) {
                console.error('Error during logout:', logoutError);
            }

            sock.end();
            sock = null;
        }

        isConnected = false;
        qrCode = null;

        const authPath = path.join(__dirname, 'auth_info');
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('Auth info deleted');
        }

        console.log('WhatsApp disconnected successfully');
        res.json({
            success: true,
            message: 'WhatsApp disconnected successfully.'
        });

    } catch (error) {
        console.error('Error disconnecting WhatsApp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/reconnect', async (req, res) => {
    try {
        console.log('Reconnect request received');
        if (sock) {
            sock.end();
            sock = null;
        }

        isConnected = false;
        qrCode = null;

        await initWhatsApp();
        res.json({ success: true, message: 'Reconnection initiated. Check terminal for QR code.' });

    } catch (error) {
        console.error('Error reconnecting WhatsApp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`WhatsApp service running on port ${PORT}`);
    initWhatsApp();
});
