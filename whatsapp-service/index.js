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

// ============================================
// STATEFUL CONVERSATION MANAGEMENT
// ============================================
const conversationState = new Map();

// Conversation steps
const STEPS = {
    START: 'START',
    AWAITING_NAME: 'AWAITING_NAME',
    AWAITING_ADDRESS: 'AWAITING_ADDRESS',
    AWAITING_ORDER: 'AWAITING_ORDER',
    AWAITING_20L_QTY: 'AWAITING_20L_QTY',
    AWAITING_25L_QTY: 'AWAITING_25L_QTY',
    AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION'
};

// Session timeout (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [phone, session] of conversationState.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
            conversationState.delete(phone);
            console.log(`[Session] Expired session for ${phone}`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// ============================================
// WHATSAPP INITIALIZATION
// ============================================
async function initWhatsApp() {
    try {
        const { state: authState, saveCreds } = await useMultiFileAuthState('auth_info');

        sock = makeWASocket({
            auth: authState,
            printQRInTerminal: false,
            browser: ['Thanni Canuuu', 'Chrome', '1.0.0']
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

// ============================================
// API HELPERS
// ============================================

// Get customer by phone number
async function getCustomerByPhone(phoneNumber) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/customers/${phoneNumber}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        console.error('Error fetching customer:', error.message);
        return null;
    }
}

// Create new customer
async function createCustomer(phoneNumber, name, address) {
    try {
        const response = await axios.post(`${FASTAPI_URL}/api/customers`, {
            phone_number: phoneNumber,
            name: name,
            address: address
        });
        return response.data;
    } catch (error) {
        console.error('Error creating customer:', error.message);
        throw error;
    }
}

// Get product prices dynamically from backend
async function getProductPrices() {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/products/prices`);
        return response.data;
    } catch (error) {
        console.error('Error fetching prices:', error.message);
        // Return null to indicate prices couldn't be fetched
        return null;
    }
}

// Check inventory availability
async function checkInventory(totalCans) {
    try {
        const response = await axios.post(`${FASTAPI_URL}/api/inventory/check`, {
            quantity: totalCans
        });
        return response.data;
    } catch (error) {
        console.error('Error checking inventory:', error.message);
        return { available: false, available_stock: 0 };
    }
}

// Create order via backend
async function createOrder(orderData) {
    try {
        const response = await axios.post(`${FASTAPI_URL}/api/orders/create`, orderData);
        return response.data;
    } catch (error) {
        console.error('Error creating order:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================
// MESSAGE HANDLING
// ============================================

async function handleIncomingMessage(message) {
    try {
        const remoteJid = message.key.remoteJid;

        // Ignore group messages
        if (remoteJid.endsWith('@g.us')) {
            console.log(`[Bot] Ignoring group message from: ${remoteJid}`);
            return;
        }

        const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
        const msgContent = message.message;

        // Extract message text
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

        // Check if this is a delivery staff responding
        const isDeliveryStaff = await checkIfDeliveryStaff(phoneNumber);
        if (isDeliveryStaff) {
            await handleDeliveryStaffMessage(phoneNumber, messageText);
            return;
        }

        // Handle customer conversation
        await handleCustomerConversation(phoneNumber, messageText);

    } catch (error) {
        console.error('Error handling incoming message:', error);
    }
}

// Check if phone belongs to delivery staff
async function checkIfDeliveryStaff(phoneNumber) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/delivery-staff`);
        const staff = response.data;
        return staff.some(s => s.phone_number === phoneNumber || s.phone_number === `91${phoneNumber}` || `91${s.phone_number}` === phoneNumber);
    } catch (error) {
        return false;
    }
}

// Handle delivery staff messages
async function handleDeliveryStaffMessage(phoneNumber, messageText) {
    try {
        // Forward to backend for processing
        await axios.post(`${FASTAPI_URL}/api/whatsapp/delivery-response`, {
            phone_number: phoneNumber,
            message: messageText
        });
    } catch (error) {
        console.error('Error handling delivery staff message:', error.message);
    }
}

// ============================================
// CUSTOMER CONVERSATION FLOW
// ============================================

async function handleCustomerConversation(phoneNumber, messageText) {
    // Get or create session
    let session = conversationState.get(phoneNumber) || {
        step: STEPS.START,
        lastActivity: Date.now()
    };

    // Update last activity
    session.lastActivity = Date.now();

    console.log(`[Bot] User ${phoneNumber} at step: ${session.step}`);

    try {
        switch (session.step) {
            case STEPS.START:
                await handleStartStep(phoneNumber, session, messageText);
                break;

            case STEPS.AWAITING_NAME:
                await handleNameStep(phoneNumber, session, messageText);
                break;

            case STEPS.AWAITING_ADDRESS:
                await handleAddressStep(phoneNumber, session, messageText);
                break;

            case STEPS.AWAITING_ORDER:
                await handleOrderStep(phoneNumber, session, messageText);
                break;

            case STEPS.AWAITING_20L_QTY:
                await handleQuantity20LStep(phoneNumber, session, messageText);
                break;

            case STEPS.AWAITING_25L_QTY:
                await handleQuantity25LStep(phoneNumber, session, messageText);
                break;

            case STEPS.AWAITING_CONFIRMATION:
                await handleConfirmationStep(phoneNumber, session, messageText);
                break;

            default:
                // Reset to start
                session.step = STEPS.START;
                conversationState.set(phoneNumber, session);
                await handleStartStep(phoneNumber, session, messageText);
        }
    } catch (error) {
        console.error('Error in conversation flow:', error);
        await sendMessage(phoneNumber, "Sorry, something went wrong. Please send 'hi' to start over.");
        conversationState.delete(phoneNumber);
    }
}

// STEP: START - Check if new or returning customer
async function handleStartStep(phoneNumber, session, messageText) {
    // Check if customer exists in backend
    const customer = await getCustomerByPhone(phoneNumber);

    if (customer && customer.name && customer.address) {
        // Returning customer - greet by name
        session.customer = customer;
        session.step = STEPS.AWAITING_ORDER;
        conversationState.set(phoneNumber, session);

        await sendMessage(phoneNumber,
            `Hi ${customer.name} 👋\n` +
            `Welcome back to Thanni Canuuu! 💧\n\n` +
            `How many water cans do you need today?`
        );

        // Show prices and ask for order
        await showPricesAndAskOrder(phoneNumber, session);
    } else {
        // New customer - ask for name
        session.step = STEPS.AWAITING_NAME;
        conversationState.set(phoneNumber, session);

        await sendMessage(phoneNumber,
            `Hi 👋 Welcome to Thanni Canuuu! 💧\n\n` +
            `We deliver fresh drinking water right to your doorstep.\n\n` +
            `May I know your name?`
        );
    }
}

// STEP: AWAITING_NAME - Collect customer name
async function handleNameStep(phoneNumber, session, messageText) {
    const name = messageText.trim();

    if (name.length < 2) {
        await sendMessage(phoneNumber, "Please share your name (at least 2 characters):");
        return;
    }

    // Store name in session
    session.name = name;
    session.step = STEPS.AWAITING_ADDRESS;
    conversationState.set(phoneNumber, session);

    await sendMessage(phoneNumber,
        `Thanks, ${name}! 🙏\n\n` +
        `Please share your *delivery address*\n` +
        `(Include landmark if possible)`
    );
}

// STEP: AWAITING_ADDRESS - Collect delivery address
async function handleAddressStep(phoneNumber, session, messageText) {
    const address = messageText.trim();

    if (address.length < 10) {
        await sendMessage(phoneNumber,
            "Please provide a complete address with area/street name and landmark.\n" +
            "(Minimum 10 characters)"
        );
        return;
    }

    // Save customer to backend
    try {
        const customer = await createCustomer(phoneNumber, session.name, address);
        session.customer = customer;
        session.address = address;
        session.step = STEPS.AWAITING_ORDER;
        conversationState.set(phoneNumber, session);

        await sendMessage(phoneNumber,
            `Perfect! ✅\n` +
            `Your profile is saved.\n\n` +
            `Let's get you some fresh water! 💧`
        );

        // Show prices and ask for order
        await showPricesAndAskOrder(phoneNumber, session);
    } catch (error) {
        await sendMessage(phoneNumber,
            "Sorry, there was an error saving your details. Please try again."
        );
        conversationState.delete(phoneNumber);
    }
}

// Show prices and prompt for order
async function showPricesAndAskOrder(phoneNumber, session) {
    const prices = await getProductPrices();

    if (!prices) {
        await sendMessage(phoneNumber,
            "Sorry, couldn't fetch prices. Please try again later."
        );
        conversationState.delete(phoneNumber);
        return;
    }

    // Store prices in session
    session.prices = prices;
    session.step = STEPS.AWAITING_20L_QTY;
    conversationState.set(phoneNumber, session);

    await sendMessage(phoneNumber,
        `*Today's Prices:*\n\n` +
        `🚰 20L Can – ₹${prices['20L']}\n` +
        `🚰 25L Can – ₹${prices['25L']}\n\n` +
        `How many *20L cans* do you need?\n` +
        `(Enter 0 if you don't need any)`
    );
}

// STEP: AWAITING_ORDER - Handle order initiation (for returning customers who message randomly)
async function handleOrderStep(phoneNumber, session, messageText) {
    // Show prices and start order flow
    await showPricesAndAskOrder(phoneNumber, session);
}

// STEP: AWAITING_20L_QTY - Collect 20L quantity
async function handleQuantity20LStep(phoneNumber, session, messageText) {
    const qty = parseInt(messageText);

    if (isNaN(qty) || qty < 0 || qty > 50) {
        await sendMessage(phoneNumber,
            "Please enter a valid number (0-50):"
        );
        return;
    }

    session.qty20L = qty;
    session.step = STEPS.AWAITING_25L_QTY;
    conversationState.set(phoneNumber, session);

    if (qty > 0) {
        await sendMessage(phoneNumber,
            `Got it! ${qty} × 20L cans ✓\n\n` +
            `How many *25L cans* do you need?\n` +
            `(Enter 0 if you don't need any)`
        );
    } else {
        await sendMessage(phoneNumber,
            `No 20L cans. Got it!\n\n` +
            `How many *25L cans* do you need?`
        );
    }
}

// STEP: AWAITING_25L_QTY - Collect 25L quantity
async function handleQuantity25LStep(phoneNumber, session, messageText) {
    const qty = parseInt(messageText);

    if (isNaN(qty) || qty < 0 || qty > 50) {
        await sendMessage(phoneNumber,
            "Please enter a valid number (0-50):"
        );
        return;
    }

    session.qty25L = qty;

    // Check if at least one item ordered
    if (session.qty20L === 0 && qty === 0) {
        await sendMessage(phoneNumber,
            "You need to order at least 1 can! 😊\n\n" +
            "How many *20L cans* do you need?"
        );
        session.step = STEPS.AWAITING_20L_QTY;
        conversationState.set(phoneNumber, session);
        return;
    }

    // Calculate totals
    const total20L = session.qty20L * session.prices['20L'];
    const total25L = qty * session.prices['25L'];
    const grandTotal = total20L + total25L;
    const totalCans = session.qty20L + qty;

    // Check inventory
    const inventory = await checkInventory(totalCans);
    session.inventoryAvailable = inventory.available;
    session.step = STEPS.AWAITING_CONFIRMATION;
    conversationState.set(phoneNumber, session);

    // Build order summary
    const customerName = session.customer?.name || session.name;
    const deliveryAddress = session.customer?.address || session.address;

    let items = [];
    if (session.qty20L > 0) {
        items.push(`• ${session.qty20L} × 20L cans – ₹${total20L}`);
    }
    if (qty > 0) {
        items.push(`• ${qty} × 25L cans – ₹${total25L}`);
    }

    let stockNote = '';
    if (!inventory.available) {
        stockNote = `\n\n📅 *Note:* Today's stock is fully booked.\nYour order will be scheduled for *tomorrow morning*.`;
    }

    await sendMessage(phoneNumber,
        `*📦 Order Summary*\n\n` +
        `${items.join('\n')}\n\n` +
        `*Total: ₹${grandTotal}*\n\n` +
        `📍 Delivery to:\n${deliveryAddress}` +
        stockNote +
        `\n\n✅ Confirm order?\nReply *YES* or *NO*`
    );
}

// STEP: AWAITING_CONFIRMATION - Handle order confirmation
async function handleConfirmationStep(phoneNumber, session, messageText) {
    const response = messageText.toUpperCase().trim();

    if (response === 'YES' || response === 'Y') {
        await processOrder(phoneNumber, session);
    } else if (response === 'NO' || response === 'N') {
        conversationState.delete(phoneNumber);
        await sendMessage(phoneNumber,
            "Order cancelled ❌\n\n" +
            "Send any message when you're ready to order again! 💧"
        );
    } else {
        await sendMessage(phoneNumber,
            "Please reply *YES* to confirm or *NO* to cancel."
        );
    }
}

// Process the confirmed order
async function processOrder(phoneNumber, session) {
    try {
        await sendMessage(phoneNumber, "Processing your order... ⏳");

        const customerName = session.customer?.name || session.name;
        const deliveryAddress = session.customer?.address || session.address;

        // Determine delivery date
        const today = new Date();
        let deliveryDate = today.toISOString().split('T')[0];
        let isScheduledForTomorrow = false;

        if (!session.inventoryAvailable) {
            // Schedule for tomorrow
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            deliveryDate = tomorrow.toISOString().split('T')[0];
            isScheduledForTomorrow = true;
        }

        // Build order items
        const items = [];
        if (session.qty20L > 0) {
            items.push({
                litre_size: 20,
                quantity: session.qty20L,
                price_per_can: session.prices['20L']
            });
        }
        if (session.qty25L > 0) {
            items.push({
                litre_size: 25,
                quantity: session.qty25L,
                price_per_can: session.prices['25L']
            });
        }

        // Create order
        const orderData = {
            customer_phone: phoneNumber,
            customer_name: customerName,
            customer_address: deliveryAddress,
            items: items,
            delivery_date: deliveryDate,
            is_tomorrow_order: isScheduledForTomorrow
        };

        const result = await createOrder(orderData);

        if (result.success) {
            let confirmationMsg = `✅ *Order Confirmed!*\n\n` +
                `Order ID: ${result.order_id}\n`;

            if (result.delivery_staff) {
                confirmationMsg += `Delivery by: ${result.delivery_staff}\n`;
            }

            if (isScheduledForTomorrow) {
                confirmationMsg += `\n📅 Today's cans are fully booked.\n` +
                    `Your order is scheduled for *tomorrow morning* 🚚\n` +
                    `Thank you for your patience!`;
            } else {
                confirmationMsg += `\n🚚 Delivery scheduled for *today*!`;
            }

            confirmationMsg += `\n\nThank you for choosing Thanni Canuuu! 💧`;

            await sendMessage(phoneNumber, confirmationMsg);
            conversationState.delete(phoneNumber);
        } else {
            throw new Error(result.message || 'Order creation failed');
        }
    } catch (error) {
        console.error('Order processing error:', error);
        const errorMsg = error.response?.data?.detail || error.message || 'Unknown error';
        await sendMessage(phoneNumber,
            `❌ Sorry, couldn't place your order.\n\n` +
            `Error: ${errorMsg}\n\n` +
            `Please try again or contact support.`
        );
        conversationState.delete(phoneNumber);
    }
}

// ============================================
// SEND MESSAGE HELPER
// ============================================

async function sendMessage(phoneNumber, text) {
    try {
        if (!sock) {
            throw new Error('WhatsApp not connected');
        }

        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text });
        console.log(`[Bot] Sent to ${phoneNumber}: ${text.substring(0, 50)}...`);
        return { success: true };

    } catch (error) {
        console.error('Error sending message:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// EXPRESS API ENDPOINTS
// ============================================

app.get('/qr', (req, res) => {
    res.json({ qr: qrCode || null });
});

app.post('/send', async (req, res) => {
    const { phone_number, message } = req.body;
    const result = await sendMessage(phone_number, message);
    res.json(result);
});

app.get('/status', (req, res) => {
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

// Get active conversation sessions (for debugging)
app.get('/sessions', (req, res) => {
    const sessions = [];
    for (const [phone, session] of conversationState.entries()) {
        sessions.push({
            phone,
            step: session.step,
            lastActivity: new Date(session.lastActivity).toISOString()
        });
    }
    res.json({ count: sessions.length, sessions });
});

// Clear a specific session
app.delete('/sessions/:phone', (req, res) => {
    const phone = req.params.phone;
    if (conversationState.has(phone)) {
        conversationState.delete(phone);
        res.json({ success: true, message: `Session for ${phone} cleared` });
    } else {
        res.status(404).json({ success: false, message: 'Session not found' });
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp service running on port ${PORT}`);
    console.log(`📡 Backend API: ${FASTAPI_URL}`);
    console.log('');
    initWhatsApp();
});
