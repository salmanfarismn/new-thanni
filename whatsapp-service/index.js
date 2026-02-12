/**
 * Multi-Vendor WhatsApp Service for Thanni Canuuu
 * 
 * Enhanced with:
 * - Smart follow-up handling (no repeated questions)
 * - Delivery queue management (FIFO, no message spam)
 * - Payment tracking and confirmation flows
 * - Per-customer state persistence in backend
 */

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

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;
if (!SERVICE_API_KEY) {
    console.error('FATAL: SERVICE_API_KEY environment variable is required. Set it in .env file.');
    process.exit(1);
}
const PORT = process.env.PORT || 3001;

// Configure axios for secure backend communication
axios.defaults.headers.common['x-api-key'] = SERVICE_API_KEY;

// ============================================
// CONSTANTS
// ============================================

// Conversation steps - Enhanced flow
const STEPS = {
    IDLE: 'IDLE',                           // No active conversation
    AWAITING_MENU_CHOICE: 'AWAITING_MENU_CHOICE', // Asking status or new order
    AWAITING_NAME: 'AWAITING_NAME',         // Asking for name (new customer)
    AWAITING_ADDRESS: 'AWAITING_ADDRESS',   // Asking for address (new customer)
    AWAITING_CAN_TYPE: 'AWAITING_CAN_TYPE', // Asking 20L/25L/Both
    AWAITING_QTY_20L: 'AWAITING_QTY_20L',   // Asking quantity for 20L
    AWAITING_QTY_25L: 'AWAITING_QTY_25L',   // Asking quantity for 25L
    AWAITING_CONFIRM: 'AWAITING_CONFIRM',   // Confirming order
    AWAITING_PAYMENT_CHOICE: 'AWAITING_PAYMENT_CHOICE' // Asking payment method
};

// Customer states (synced with backend)
const CUSTOMER_STATES = {
    IDLE: 'idle',
    ORDERING: 'ordering',
    AWAITING_CONFIRMATION: 'awaiting_confirmation',
    ORDER_ACTIVE: 'order_active',
    CHECKING_STATUS: 'checking_status',
    PAYMENT_PENDING: 'payment_pending'
};

// Payment statuses
const PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID_CASH: 'paid_cash',
    PAID_UPI: 'paid_upi',
    UPI_PENDING: 'upi_pending',
    CASH_DUE: 'cash_due',
    DELIVERED_UNPAID: 'delivered_unpaid'
};

// ============================================
// MULTI-VENDOR SESSION MANAGEMENT
// ============================================

/**
 * Store for all vendor WhatsApp clients
 * Map<vendorId, { sock, qrCode, isConnected, user }>
 */
const vendorClients = new Map();

/**
 * Store for customer conversation states (keyed by vendorId:phoneNumber)
 * This is for quick in-memory access, synced with backend
 */
const conversationState = new Map();

/**
 * Delivery queue per staff (keyed by vendorId:staffId)
 * For FIFO processing
 */
const deliveryQueues = new Map();

// Session timeout (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Reconnection settings
const RECONNECT_SETTINGS = {
    baseDelay: 5000,      // 5 seconds base delay
    maxDelay: 300000,     // 5 minutes max delay  
    maxRetries: 10        // Max retries before giving up
};

// Track reconnection attempts per vendor
const reconnectAttempts = new Map();

/**
 * Calculate exponential backoff delay
 */
function getReconnectDelay(vendorId) {
    const attempts = reconnectAttempts.get(vendorId) || 0;
    const delay = Math.min(
        RECONNECT_SETTINGS.baseDelay * Math.pow(2, attempts),
        RECONNECT_SETTINGS.maxDelay
    );
    return delay;
}

/**
 * Reset reconnection attempts on successful connection
 */
function resetReconnectAttempts(vendorId) {
    reconnectAttempts.set(vendorId, 0);
}

/**
 * Increment reconnection attempts
 */
function incrementReconnectAttempts(vendorId) {
    const current = reconnectAttempts.get(vendorId) || 0;
    reconnectAttempts.set(vendorId, current + 1);
    return current + 1;
}

// Clean up expired conversation sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of conversationState.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
            conversationState.delete(key);
            console.log(`[Session] Expired: ${key}`);
        }
    }
}, 5 * 60 * 1000);

// Health check for all connected vendors (every 2 minutes)
setInterval(() => {
    for (const [vendorId, client] of vendorClients.entries()) {
        if (client.isConnected && client.sock) {
            try {
                // Update last activity
                client.lastHealthCheck = Date.now();
                console.log(`[Health] Vendor ${vendorId.substring(0, 8)}: Connected ✓`);
            } catch (error) {
                console.error(`[Health] Vendor ${vendorId.substring(0, 8)}: Error - ${error.message}`);
            }
        }
    }
}, 2 * 60 * 1000);

// ============================================
// VENDOR WHATSAPP INITIALIZATION
// ============================================

/**
 * Initialize WhatsApp client for a specific vendor
 */
// Track initialization promises to prevent race conditions
const initializationPromises = new Map();

/**
 * Initialize WhatsApp client for a specific vendor
 */
async function initVendorWhatsApp(vendorId) {
    // Prevent concurrent initializations for the same vendor
    if (initializationPromises.has(vendorId)) {
        console.log(`[Vendor ${vendorId.substring(0, 8)}] Initialization already in progress, joining...`);
        return initializationPromises.get(vendorId);
    }

    const initPromise = (async () => {
        try {
            console.log(`[Vendor ${vendorId.substring(0, 8)}] Initializing WhatsApp...`);

            // Cleanup existing session if it exists to prevent conflict
            const existing = vendorClients.get(vendorId);
            if (existing && existing.sock) {
                console.log(`[Vendor ${vendorId.substring(0, 8)}] Closing hanging connection...`);
                try {
                    existing.sock.end(undefined);
                } catch (e) {
                    // Ignore close errors
                }
                vendorClients.delete(vendorId);
            }

            const authPath = path.join(__dirname, `auth_info_${vendorId}`);
            const { state: authState, saveCreds } = await useMultiFileAuthState(authPath);

            const sock = makeWASocket({
                auth: authState,
                printQRInTerminal: false,
                browser: ['Thanni Canuuu', 'Chrome', '1.0.0'],
                // Improve stability
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                retryRequestDelayMs: 5000
            });

            // Initialize client state immediately
            vendorClients.set(vendorId, {
                sock,
                qrCode: null,
                isConnected: false,
                user: null,
                lastActivity: Date.now()
            });

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                const client = vendorClients.get(vendorId);

                // If client was removed (race condition), ignore updates
                if (!client || client.sock !== sock) return;

                console.log(`[Vendor ${vendorId.substring(0, 8)}] Connection:`, { connection, hasQr: !!qr });

                if (qr) {
                    client.qrCode = qr;
                    console.log(`\n--- VENDOR ${vendorId.substring(0, 8)} QR CODE ---`);
                    qrcode.generate(qr, { small: true });
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    client.isConnected = false;
                    client.qrCode = null;

                    if (shouldReconnect) {
                        const attempts = incrementReconnectAttempts(vendorId);

                        if (attempts > RECONNECT_SETTINGS.maxRetries) {
                            console.error(`[Vendor ${vendorId.substring(0, 8)}] Max reconnection attempts (${RECONNECT_SETTINGS.maxRetries}) reached.`);
                            vendorClients.delete(vendorId);
                            return;
                        }

                        const delay = getReconnectDelay(vendorId);
                        console.log(`[Vendor ${vendorId.substring(0, 8)}] Reconnecting in ${delay / 1000}s (attempt ${attempts}/${RECONNECT_SETTINGS.maxRetries})`);

                        setTimeout(() => initVendorWhatsApp(vendorId), delay);
                    } else {
                        console.log(`[Vendor ${vendorId.substring(0, 8)}] Logged out. Removing session.`);
                        vendorClients.delete(vendorId);

                        // Clean up auth folder
                        try {
                            fs.rmSync(authPath, { recursive: true, force: true });
                        } catch (e) { console.error('Error cleaning auth folder:', e); }
                    }
                } else if (connection === 'open') {
                    console.log(`\n✅ [Vendor ${vendorId.substring(0, 8)}] WhatsApp connected!`);
                    client.qrCode = null;
                    client.isConnected = true;
                    client.user = sock.user;
                    client.connectedAt = Date.now();

                    // Reset reconnection attempts
                    resetReconnectAttempts(vendorId);
                }
            });

            sock.ev.on('messages.upsert', async (m) => {
                const { messages, type } = m;
                if (type === 'notify') {
                    for (const message of messages) {
                        if (!message.key.fromMe && message.message) {
                            try {
                                console.log(`[Vendor ${vendorId.substring(0, 8)}] Msg:`, message.key.remoteJid);
                                await handleIncomingMessage(vendorId, message);
                            } catch (err) {
                                console.error(`[Vendor ${vendorId.substring(0, 8)}] Message handler error:`, err);
                            }
                        }
                    }
                }
            });

            sock.ev.on('creds.update', saveCreds);

        } catch (error) {
            console.error(`[Vendor ${vendorId.substring(0, 8)}] Init error:`, error);
            // Don't auto-retry immediately in loop, let user/frontend retry via polling
            vendorClients.delete(vendorId);
        }
    })();

    initializationPromises.set(vendorId, initPromise);
    try {
        await initPromise;
    } finally {
        initializationPromises.delete(vendorId);
    }
}

// ============================================
// API HELPERS
// ============================================

// Get customer by phone for a specific vendor
async function getCustomerByPhone(vendorId, phoneNumber) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/customers/lookup/${phoneNumber}`, {
            params: { vendor_id: vendorId }
        });
        console.log(`[API] Found customer for vendor ${vendorId.substring(0, 8)}:`, response.data.name);
        return response.data;
    } catch (error) {
        console.log(`[API] No customer found for ${phoneNumber}`);
        return null;
    }
}

// Create customer for a specific vendor
async function createCustomer(vendorId, phoneNumber, name, address) {
    try {
        const response = await axios.post(`${FASTAPI_URL}/api/customers/whatsapp`, {
            phone_number: phoneNumber,
            name: name,
            address: address,
            vendor_id: vendorId
        });
        console.log(`[API] Created customer for vendor ${vendorId.substring(0, 8)}:`, response.data);
        return response.data;
    } catch (error) {
        const errorMsg = `[API] Error creating customer: ${error.message}\n`;
        fs.appendFileSync('error.log', errorMsg);
        console.error(errorMsg.trim());
        return null;
    }
}

// Get product prices
async function getProductPrices(vendorId) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/products/prices`, {
            params: { vendor_id: vendorId }
        });
        return response.data;
    } catch (error) {
        console.error('[API] Error fetching prices:', error.message);
        return { '20L': 50, '25L': 65 }; // Default prices
    }
}

// Create order
async function createOrder(vendorId, orderData) {
    try {
        console.log(`[API] Creating order for vendor ${vendorId.substring(0, 8)}:`, orderData);
        const response = await axios.post(`${FASTAPI_URL}/api/orders/create`, {
            ...orderData,
            vendor_id: vendorId
        });
        console.log(`[API] Order created:`, response.data);
        return response.data;
    } catch (error) {
        console.error('[API] Error creating order:', error.response?.data || error.message);
        throw error;
    }
}

// Check if delivery staff
async function checkIfDeliveryStaff(vendorId, phoneNumber) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/delivery-staff/check/${phoneNumber}`, {
            params: { vendor_id: vendorId }
        });
        return response.data ? response.data : null;
    } catch (error) {
        return null;
    }
}

// Get customer's active order
async function getCustomerActiveOrder(vendorId, phoneNumber) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/customers/${phoneNumber}/active-order`, {
            params: { vendor_id: vendorId }
        });
        return response.data;
    } catch (error) {
        console.error('[API] Error fetching active order:', error.message);
        return { has_active_order: false, order: null };
    }
}

// Get customer's latest order
async function getCustomerLatestOrder(vendorId, phoneNumber) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/customers/${phoneNumber}/latest-order`, {
            params: { vendor_id: vendorId }
        });
        return response.data;
    } catch (error) {
        console.error('[API] Error fetching latest order:', error.message);
        return { order: null };
    }
}

// Complete delivery with payment status
async function completeDelivery(vendorId, orderId, paymentStatus) {
    try {
        const response = await axios.post(`${FASTAPI_URL}/api/orders/${orderId}/delivery/complete`, null, {
            params: {
                vendor_id: vendorId,
                payment_status: paymentStatus
            }
        });
        return response.data;
    } catch (error) {
        console.error('[API] Error completing delivery:', error.message);
        throw error;
    }
}

// Handle customer payment response
async function handleCustomerPaymentResponse(vendorId, orderId, response) {
    try {
        const result = await axios.post(`${FASTAPI_URL}/api/orders/${orderId}/payment/customer-response`, null, {
            params: {
                vendor_id: vendorId,
                response: response
            }
        });
        return result.data;
    } catch (error) {
        console.error('[API] Error handling payment response:', error.message);
        throw error;
    }
}

/**
 * Robust message text extraction from Baileys message object
 */
function getMessageText(m) {
    if (!m) return '';
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId;
    if (m.listResponseMessage?.singleSelectReply?.selectedRowId) return m.listResponseMessage.singleSelectReply.selectedRowId;
    if (m.templateButtonReplyMessage?.selectedId) return m.templateButtonReplyMessage.selectedId;

    // Handle nested messages
    if (m.ephemeralMessage?.message) return getMessageText(m.ephemeralMessage.message);
    if (m.viewOnceMessage?.message) return getMessageText(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return getMessageText(m.viewOnceMessageV2.message);

    return '';
}

// Get staff's next pending delivery
async function getStaffNextDelivery(vendorId, staffId) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/delivery-staff/${staffId}/orders`, {
            params: {
                vendor_id: vendorId,
                status: 'pending'
            }
        });
        const orders = response.data;
        return orders.length > 0 ? orders[0] : null;
    } catch (error) {
        console.error('[API] Error fetching staff orders:', error.message);
        return null;
    }
}

// Get staff's next pending delivery
async function getStaffNextDelivery(vendorId, staffId) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/delivery-staff/${staffId}/pending-orders`, {
            params: { vendor_id: vendorId }
        });
        const orders = response.data;
        // Return first unacknowledged order
        return orders.find(o => !o.delivery_queue_acknowledged) || null;
    } catch (error) {
        console.error('[API] Error fetching staff orders:', error.message);
        return null;
    }
}

// ============================================
// MESSAGE HANDLING
// ============================================

async function handleIncomingMessage(vendorId, message) {
    try {
        const remoteJid = message.key.remoteJid;

        // Ignore group messages
        if (remoteJid.endsWith('@g.us')) return;

        const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
        const msgContent = message.message;

        // Use robust extraction
        const messageText = getMessageText(msgContent).trim();

        console.log(`[${vendorId.substring(0, 8)}] From ${phoneNumber}: "${messageText}"`);

        if (!messageText && !msgContent.buttonsResponseMessage && !msgContent.listResponseMessage) {
            // Log full message for debugging if it's empty but has something
            if (Object.keys(msgContent).length > 0) {
                console.log(`[Debug] Empty text but content:`, JSON.stringify(msgContent).substring(0, 200));
            }
            return;
        }

        // Check if delivery staff
        const staffInfo = await checkIfDeliveryStaff(vendorId, phoneNumber);
        if (staffInfo && staffInfo.is_staff) {
            await handleDeliveryStaffMessage(vendorId, phoneNumber, messageText, staffInfo);
            return;
        }

        // Handle customer conversation
        await handleCustomerConversation(vendorId, phoneNumber, messageText);

    } catch (error) {
        console.error('[Error] handleIncomingMessage:', error);
    }
}

// ============================================
// DELIVERY STAFF MESSAGE HANDLING
// Enhanced with structured responses
// ============================================

async function handleDeliveryStaffMessage(vendorId, phoneNumber, messageText, staffInfo) {
    const client = vendorClients.get(vendorId);
    if (!client?.sock) return;

    const jid = `${phoneNumber}@s.whatsapp.net`;
    const text = messageText.toLowerCase().trim();

    // Send helper function
    const send = async (msg) => {
        await client.sock.sendMessage(jid, { text: msg });
    };

    // Find staff's latest pending order
    let pendingOrder = null;
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/delivery-staff/${staffInfo.staff_id}/orders`, {
            params: {
                vendor_id: vendorId,
                status: 'pending'
            }
        });
        if (response.data && response.data.length > 0) {
            pendingOrder = response.data[0];
        }
    } catch (error) {
        console.error('[API] Error fetching staff orders:', error.message);
    }

    // Handle numeric responses for delivery completion
    if (['1', '2', '3'].includes(text) && pendingOrder) {
        const orderId = pendingOrder.order_id;

        try {
            let paymentStatus;
            let responseMsg;

            if (text === '1') {
                // Delivered & Cash Paid
                paymentStatus = PAYMENT_STATUS.PAID_CASH;
                responseMsg = `✅ Order ${orderId} delivered!\nPayment: Cash ₹${pendingOrder.amount} ✓\n\nGreat work! 👍`;
            } else if (text === '2') {
                // Delivered & UPI Paid
                paymentStatus = PAYMENT_STATUS.PAID_UPI;
                responseMsg = `✅ Order ${orderId} delivered!\nPayment: UPI ₹${pendingOrder.amount} ✓\n\nGreat work! 👍`;
            } else if (text === '3') {
                // Delivered & Not Paid - trigger customer notification
                paymentStatus = PAYMENT_STATUS.DELIVERED_UNPAID;
                responseMsg = `✅ Order ${orderId} delivered!\n⏳ Payment: Pending\n\nCustomer will be notified to confirm payment.`;
            }

            // Complete delivery via API
            const result = await completeDelivery(vendorId, orderId, paymentStatus);
            await send(responseMsg);

            // If unpaid, send payment confirmation to customer
            if (result.trigger_customer_payment) {
                await sendCustomerPaymentRequest(vendorId, pendingOrder.customer_phone, pendingOrder);
            }

        } catch (error) {
            await send(`❌ Could not update order ${orderId}. Please try again.`);
        }
        return;
    }

    // Handle "done ORDER_ID" format
    const doneMatch = text.match(/^(done|delivered)\s+(\S+)/i);
    if (doneMatch) {
        const orderId = doneMatch[2].toUpperCase();
        try {
            await axios.patch(`${FASTAPI_URL}/api/orders/${orderId}/status`, null, {
                params: { status: 'delivered' }
            });
            await send(`✅ Order ${orderId} marked as delivered!`);
        } catch (error) {
            await send(`❌ Could not update ${orderId}`);
        }
        return;
    }

    // Handle "paid ORDER_ID cash/upi" format
    const paidMatch = text.match(/^paid\s+(\S+)\s*(cash|upi)?/i);
    if (paidMatch) {
        const orderId = paidMatch[1].toUpperCase();
        const method = paidMatch[2]?.toLowerCase() || 'cash';
        try {
            await axios.patch(`${FASTAPI_URL}/api/orders/${orderId}/payment`, null, {
                params: {
                    payment_status: method === 'upi' ? 'paid_upi' : 'paid_cash',
                    payment_method: method
                }
            });
            await send(`✅ ${orderId} marked PAID (${method})!`);
        } catch (error) {
            await send(`❌ Could not update ${orderId}`);
        }
        return;
    }

    // Show current order or help
    if (pendingOrder) {
        await send(
            `🚚 *Current Delivery*\n\n` +
            `Order: *${pendingOrder.order_id}*\n` +
            `Customer: ${pendingOrder.customer_name}\n` +
            `Phone: ${pendingOrder.customer_phone}\n` +
            `Address: ${pendingOrder.customer_address}\n` +
            `Items: ${pendingOrder.quantity} × ${pendingOrder.litre_size}L\n` +
            `Amount: ₹${pendingOrder.amount}\n\n` +
            `*Reply:*\n` +
            `*1* - Delivered & Cash Paid\n` +
            `*2* - Delivered & UPI Paid\n` +
            `*3* - Delivered & Not Paid`
        );
    } else {
        await send(
            `📋 *Staff Commands:*\n\n` +
            `• Reply *1/2/3* for current order\n` +
            `• *done ORDER_ID* - Mark delivered\n` +
            `• *paid ORDER_ID cash* - Mark paid\n\n` +
            `No pending orders right now.`
        );
    }
}

// Send payment request to customer after unpaid delivery
async function sendCustomerPaymentRequest(vendorId, customerPhone, order) {
    const client = vendorClients.get(vendorId);
    if (!client?.sock) return;

    const jid = `${customerPhone}@s.whatsapp.net`;

    // Store that we're waiting for payment response
    const sessionKey = `${vendorId}:${customerPhone}`;
    conversationState.set(sessionKey, {
        step: STEPS.AWAITING_PAYMENT_CHOICE,
        lastActivity: Date.now(),
        data: { orderId: order.order_id, amount: order.amount }
    });

    await client.sock.sendMessage(jid, {
        text: `Hi 👋 Your water cans were delivered.\n\n` +
            `Order: ${order.order_id}\n` +
            `Amount: ₹${order.amount}\n\n` +
            `Please confirm payment:\n\n` +
            `*1* - Pay now via UPI\n` +
            `*2* - Pay later in cash\n\n` +
            `Reply with 1 or 2.`
    });
}

// ============================================
// CUSTOMER CONVERSATION FLOW
// Enhanced with smart follow-up handling
// ============================================

async function handleCustomerConversation(vendorId, phoneNumber, messageText) {
    const client = vendorClients.get(vendorId);
    if (!client?.sock) return;

    const jid = `${phoneNumber}@s.whatsapp.net`;
    const sessionKey = `${vendorId}:${phoneNumber}`;
    const text = messageText.toLowerCase().trim();

    // Get or create session
    let session = conversationState.get(sessionKey) || {
        step: STEPS.IDLE,
        lastActivity: Date.now(),
        data: {}
    };
    session.lastActivity = Date.now();

    // Send helper function
    const send = async (msg) => {
        try {
            await client.sock.sendMessage(jid, { text: msg });
        } catch (e) {
            console.error(`[Error] Send failed to ${jid}:`, e.message);
        }
    };

    // Get prices
    const prices = await getProductPrices(vendorId) || {};
    const price20L = prices['20L'] || 50;
    const price25L = prices['25L'] || 65;

    // ============================================
    // Handle payment response if waiting
    // ============================================
    if (session.step === STEPS.AWAITING_PAYMENT_CHOICE) {
        if (text === '1' || text.includes('upi')) {
            // Customer chose UPI
            try {
                const result = await handleCustomerPaymentResponse(vendorId, session.data.orderId, 'upi');
                if (result.vendor_upi) {
                    await send(
                        `🙏 Please send ₹${result.amount} to:\n\n` +
                        `*UPI ID:* ${result.vendor_upi}\n\n` +
                        `Thank you! We'll confirm once received.`
                    );
                } else {
                    await send(
                        `🙏 Please complete UPI payment of ₹${result.amount}.\n\n` +
                        `Contact us for UPI details.\n` +
                        `Thank you!`
                    );
                }
            } catch (error) {
                await send(`Sorry, something went wrong. Please try again.`);
            }
            conversationState.delete(sessionKey);
            return;
        } else if (text === '2' || text.includes('cash')) {
            // Customer chose cash
            try {
                await handleCustomerPaymentResponse(vendorId, session.data.orderId, 'cash');
                await send(
                    `Thank you! 🙏\n\n` +
                    `Our staff will collect ₹${session.data.amount} soon.\n` +
                    `Have a great day!`
                );
            } catch (error) {
                await send(`Sorry, something went wrong. Please try again.`);
            }
            conversationState.delete(sessionKey);
            return;
        } else {
            await send(`Please reply *1* for UPI or *2* for Cash.`);
            conversationState.set(sessionKey, session);
            return;
        }
    }

    // ============================================
    // Handle menu choice (status vs new order)
    // ============================================
    if (session.step === STEPS.AWAITING_MENU_CHOICE) {
        if (text === '1' || text.includes('status')) {
            // Customer wants to check order status
            const orderInfo = await getCustomerLatestOrder(vendorId, phoneNumber);

            if (orderInfo.order) {
                const order = orderInfo.order;
                const statusEmoji = {
                    'pending': '⏳ In queue',
                    'in_queue': '📋 In queue',
                    'assigned': '👤 Assigned',
                    'out_for_delivery': '🚚 Out for delivery',
                    'delivered': '✅ Delivered',
                    'delayed': '⚠️ Delayed',
                    'cancelled': '❌ Cancelled'
                };

                await send(
                    `📦 *Your Last Order*\n\n` +
                    `Order ID: ${order.order_id}\n` +
                    `• ${order.quantity} × ${order.litre_size}L cans\n` +
                    `• Amount: ₹${order.amount}\n` +
                    `• Status: ${statusEmoji[order.status] || order.status}\n` +
                    (order.status !== 'delivered' ? `\nExpected today 🚚` : `\nDelivered on ${new Date(order.delivered_at).toLocaleDateString()}`) +
                    `\n\nThank you! 💧`
                );
            } else {
                await send(`No recent orders found.\n\nSend *Hi* to place a new order! 👋`);
            }

            conversationState.delete(sessionKey);
            return;
        } else if (text === '2' || text.includes('new') || text.includes('order')) {
            // Customer wants to place new order - start order flow
            session.step = STEPS.AWAITING_CAN_TYPE;
            await send(`Which can do you need?\n*20L* / *25L* / *Both*`);
            conversationState.set(sessionKey, session);
            return;
        } else {
            await send(`Please reply *1* for order status or *2* for new order.`);
            conversationState.set(sessionKey, session);
            return;
        }
    }

    // ============================================
    // Handle based on current step
    // ============================================
    switch (session.step) {

        case STEPS.IDLE:
            // Any greeting starts the flow
            if (['hi', 'hello', 'order', 'start', 'hii', 'hey'].includes(text) || text.length > 0) {
                // Check if returning customer with existing orders
                const customer = await getCustomerByPhone(vendorId, phoneNumber);
                const activeOrderInfo = await getCustomerActiveOrder(vendorId, phoneNumber);

                if (activeOrderInfo.has_active_order) {
                    // Customer has active order - show menu
                    session.data.customer = customer;
                    session.data.name = customer?.name;
                    session.data.address = customer?.address;
                    session.step = STEPS.AWAITING_MENU_CHOICE;

                    const order = activeOrderInfo.order;
                    await send(
                        `Hi ${customer?.name || 'there'}! 👋\n\n` +
                        `You have an active order:\n` +
                        `• ${order.quantity} × ${order.litre_size}L (₹${order.amount})\n` +
                        `• Status: ${order.status === 'pending' ? '⏳ In queue' : '🚚 On the way'}\n\n` +
                        `What would you like to do?\n\n` +
                        `*1* - Check my order status\n` +
                        `*2* - Place a new order\n\n` +
                        `Reply with 1 or 2.`
                    );
                } else if (customer && customer.name && customer.address) {
                    // Returning customer with no active order
                    session.data.customer = customer;
                    session.data.name = customer.name;
                    session.data.address = customer.address;
                    session.step = STEPS.AWAITING_CAN_TYPE;

                    await send(`Hi ${customer.name}! 👋 Welcome back!\n\nWhich can do you need?\n*20L* / *25L* / *Both*`);
                } else {
                    // New customer - ask name
                    session.step = STEPS.AWAITING_NAME;
                    await send(`Hi 👋 Welcome!\n\nMay I know your name?`);
                }
            }
            break;

        case STEPS.AWAITING_NAME:
            // Capture name
            session.data.name = messageText.trim();
            session.step = STEPS.AWAITING_ADDRESS;
            await send(`Thanks ${session.data.name}! 😊\n\nPlease share your delivery address.`);
            break;

        case STEPS.AWAITING_ADDRESS:
            // Capture address and save customer
            session.data.address = messageText.trim();

            // Save customer to DB
            await createCustomer(vendorId, phoneNumber, session.data.name, session.data.address);

            session.step = STEPS.AWAITING_CAN_TYPE;
            await send(`Great! 📍 Address saved.\n\nWhich can do you need?\n*20L* / *25L* / *Both*`);
            break;

        case STEPS.AWAITING_CAN_TYPE:
            // Parse can type
            if (text.includes('20') && text.includes('25') || text.includes('both')) {
                // Both types
                session.data.canType = 'both';
                session.step = STEPS.AWAITING_QTY_20L;
                await send(`How many *20L* cans?`);
            } else if (text.includes('20') || text === '1') {
                session.data.canType = '20';
                session.step = STEPS.AWAITING_QTY_20L;
                await send(`How many *20L* cans?`);
            } else if (text.includes('25') || text === '2') {
                session.data.canType = '25';
                session.step = STEPS.AWAITING_QTY_25L;
                await send(`How many *25L* cans?`);
            } else {
                await send(`Please reply: *20L*, *25L*, or *Both*`);
            }
            break;

        case STEPS.AWAITING_QTY_20L:
            const qty20 = parseInt(text);
            if (isNaN(qty20) || qty20 < 1 || qty20 > 50) {
                await send(`Please enter a number (1-50)`);
                break;
            }
            session.data.qty20L = qty20;

            if (session.data.canType === 'both') {
                session.step = STEPS.AWAITING_QTY_25L;
                await send(`How many *25L* cans?`);
            } else {
                // Single type - confirm
                session.step = STEPS.AWAITING_CONFIRM;
                const total = qty20 * price20L;
                await send(
                    `📋 *Order Summary*\n\n` +
                    `${qty20} × 20L = ₹${total}\n` +
                    `📍 ${session.data.address}\n\n` +
                    `Confirm? *YES* / *NO*`
                );
            }
            break;

        case STEPS.AWAITING_QTY_25L:
            const qty25 = parseInt(text);
            if (isNaN(qty25) || qty25 < 1 || qty25 > 50) {
                await send(`Please enter a number (1-50)`);
                break;
            }
            session.data.qty25L = qty25;
            session.step = STEPS.AWAITING_CONFIRM;

            // Build summary
            let summary = `📋 *Order Summary*\n\n`;
            let total = 0;

            if (session.data.qty20L > 0) {
                const sub20 = session.data.qty20L * price20L;
                summary += `${session.data.qty20L} × 20L = ₹${sub20}\n`;
                total += sub20;
            }
            const sub25 = qty25 * price25L;
            summary += `${qty25} × 25L = ₹${sub25}\n`;
            total += sub25;

            summary += `\n*Total: ₹${total}*\n`;
            summary += `📍 ${session.data.address}\n\n`;
            summary += `Confirm? *YES* / *NO*`;

            await send(summary);
            break;

        case STEPS.AWAITING_CONFIRM:
            if (['yes', 'y', 'confirm', 'ok', 'haan', 'ha'].includes(text)) {
                try {
                    // Build order items
                    const items = [];
                    if (session.data.qty20L > 0) {
                        items.push({
                            litre_size: 20,
                            quantity: session.data.qty20L,
                            price_per_can: price20L
                        });
                    }
                    if (session.data.qty25L > 0) {
                        items.push({
                            litre_size: 25,
                            quantity: session.data.qty25L,
                            price_per_can: price25L
                        });
                    }

                    // Create order
                    const result = await createOrder(vendorId, {
                        customer_phone: phoneNumber,
                        customer_name: session.data.name,
                        customer_address: session.data.address,
                        items: items
                    });

                    await send(
                        `✅ *Order Confirmed!*\n\n` +
                        `Order ID: ${result.order_id}\n` +
                        `Amount: ₹${result.total_amount}\n\n` +
                        `Your order will be delivered soon! 🚚\n\n` +
                        `Send *1* anytime to check status.`
                    );

                    // Clear session
                    conversationState.delete(sessionKey);

                } catch (error) {
                    const errMsg = error.response?.data?.detail || 'Something went wrong';
                    await send(`❌ Sorry, couldn't process order.\n${errMsg}\n\nPlease try again.`);
                    conversationState.delete(sessionKey);
                }
            } else if (['no', 'n', 'cancel', 'nahi'].includes(text)) {
                await send(`❌ Order cancelled.\n\nSend *Hi* to start again.`);
                conversationState.delete(sessionKey);
            } else {
                await send(`Reply *YES* to confirm or *NO* to cancel.`);
            }
            break;

        default:
            session.step = STEPS.IDLE;
            await send(`Send *Hi* to place an order! 👋`);
    }

    // Save session
    conversationState.set(sessionKey, session);
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeVendors: vendorClients.size,
        timestamp: new Date().toISOString()
    });
});

// Get WhatsApp status for a vendor
app.get('/status/:vendorId', async (req, res) => {
    const { vendorId } = req.params;
    const client = vendorClients.get(vendorId);

    if (!client) {
        return res.json({
            connected: false,
            initialized: false,
            message: 'WhatsApp not initialized'
        });
    }

    res.json({
        connected: client.isConnected,
        initialized: true,
        user: client.isConnected ? {
            id: client.user?.id,
            name: client.user?.name
        } : null
    });
});

// Get QR code for a vendor
app.get('/qr/:vendorId', async (req, res) => {
    const { vendorId } = req.params;

    let client = vendorClients.get(vendorId);

    if (!client) {
        await initVendorWhatsApp(vendorId);
        await new Promise(resolve => setTimeout(resolve, 2000));
        client = vendorClients.get(vendorId);
    }

    if (!client) {
        return res.json({ qr: null, error: 'Could not initialize WhatsApp' });
    }

    if (client.isConnected) {
        return res.json({ qr: null, connected: true });
    }

    res.json({ qr: client.qrCode });
});

// Initialize WhatsApp for a vendor
app.post('/init/:vendorId', async (req, res) => {
    const { vendorId } = req.params;

    if (vendorClients.has(vendorId)) {
        return res.json({ success: true, message: 'Already initialized' });
    }

    await initVendorWhatsApp(vendorId);
    res.json({ success: true, message: 'WhatsApp initialization started' });
});

// Disconnect WhatsApp
app.post('/disconnect/:vendorId', async (req, res) => {
    const { vendorId } = req.params;
    const client = vendorClients.get(vendorId);

    if (!client?.sock) {
        return res.json({ success: false, message: 'No active connection' });
    }

    try {
        try { await client.sock.logout(); } catch (e) { }
        client.sock.end();
        vendorClients.delete(vendorId);

        const authPath = path.join(__dirname, `auth_info_${vendorId}`);
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }

        res.json({ success: true, message: 'Disconnected' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reconnect WhatsApp
app.post('/reconnect/:vendorId', async (req, res) => {
    const { vendorId } = req.params;
    const client = vendorClients.get(vendorId);

    if (client?.sock) {
        client.sock.end();
    }
    vendorClients.delete(vendorId);

    await initVendorWhatsApp(vendorId);
    res.json({ success: true, message: 'Reconnection initiated' });
});

// Simulate incoming message (for testing)
app.post('/test/simulate-message/:vendorId', async (req, res) => {
    const { vendorId } = req.params;
    const { from, text } = req.body;

    console.log(`[Test] Simulating message from ${from}: ${text}`);

    // Create a mock message object that mimics Baileys structure
    const mockMessage = {
        key: {
            remoteJid: `${from}@s.whatsapp.net`,
            fromMe: false,
            id: 'TEST_MSG_' + Date.now()
        },
        message: {
            conversation: text
        }
    };

    try {
        await handleIncomingMessage(vendorId, mockMessage);
        res.json({ success: true, message: 'Message processed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send message (testing)
app.post('/send/:vendorId', async (req, res) => {
    const { vendorId } = req.params;
    const { to, message } = req.body;
    const client = vendorClients.get(vendorId);

    if (!client?.sock || !client.isConnected) {
        return res.status(400).json({ success: false, error: 'Not connected' });
    }

    try {
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        await client.sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// List active vendors
app.get('/vendors', (req, res) => {
    const vendors = [];
    for (const [vendorId, client] of vendorClients.entries()) {
        vendors.push({
            vendorId: vendorId.substring(0, 8) + '...',
            connected: client.isConnected,
            hasQr: !!client.qrCode
        });
    }
    res.json({ count: vendors.length, vendors });
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
    let connectedCount = 0;
    for (const [, client] of vendorClients.entries()) {
        if (client.isConnected) connectedCount++;
    }
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        activeVendors: vendorClients.size,
        connectedVendors: connectedCount,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: new Date().toISOString()
    });
});

// Legacy endpoints
app.get('/status', (req, res) => res.json({ message: 'Use /status/:vendorId', activeVendors: vendorClients.size }));
app.get('/qr', (req, res) => res.json({ message: 'Use /qr/:vendorId', activeVendors: vendorClients.size }));

// ============================================
// START SERVER
// ============================================

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, async () => {
    console.log(`\n🚀 WhatsApp Service running on port ${PORT}`);
    console.log(`📡 Backend: ${FASTAPI_URL}`);

    // Auto-load existing sessions
    try {
        const files = fs.readdirSync(__dirname);
        const authFolders = files.filter(f => f.startsWith('auth_info_') && fs.statSync(path.join(__dirname, f)).isDirectory());

        console.log(`\n[Startup] Found ${authFolders.length} existing sessions to restore...`);

        for (const folder of authFolders) {
            const vendorId = folder.replace('auth_info_', '');
            console.log(`[Startup] Restoring session for vendor ${vendorId.substring(0, 8)}...`);
            // Add slight delay between inits to avoid CPU spike
            await new Promise(resolve => setTimeout(resolve, 2000));
            initVendorWhatsApp(vendorId).catch(err => {
                console.error(`[Startup] Failed to restore ${vendorId}:`, err.message);
            });
        }
    } catch (error) {
        console.error('[Startup] Error auto-loading sessions:', error);
    }
});

// Graceful Shutdown
const gracefulShutdown = async () => {
    console.log('\n[Shutdown] Closing WhatsApp connections...');

    for (const [vendorId, client] of vendorClients.entries()) {
        if (client.sock) {
            try {
                console.log(`[Shutdown] Closing session for ${vendorId.substring(0, 8)}`);
                client.sock.end(undefined);
            } catch (e) {
                console.error(`[Shutdown] Error closing ${vendorId}:`, e.message);
            }
        }
    }

    server.close(() => {
        console.log('[Shutdown] Server closed.');
        process.exit(0);
    });

    // Force close if taking too long
    setTimeout(() => {
        console.error('[Shutdown] Forced exit.');
        process.exit(1);
    }, 5000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

