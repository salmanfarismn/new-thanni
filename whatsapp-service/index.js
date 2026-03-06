/**
 * Multi-Vendor WhatsApp Service for Thanni Canuuu
 * 
 * Enhanced with:
 * - Smart follow-up handling (no repeated questions)
 * - Delivery queue management (FIFO, no message spam)
 * - Payment tracking and confirmation flows
 * - Per-customer state persistence in backend
 */

const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

dotenv.config();

// i18n message templates
const { getMessage, isSupported } = require('./messages');

const app = express();
// Tighten CORS for production
const corsOptions = {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
};
app.use(cors(corsOptions));
app.use(express.json());

// API Key verification middleware for sensitive endpoints
function verifyApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== SERVICE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }
    next();
}

function logTrace(msg) {
    try {
        fs.appendFileSync('debug_trace.log', `${new Date().toISOString()} ${msg}\n`);
    } catch (e) {
        // ignore
    }
}

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
axios.defaults.timeout = 10000; // 10 seconds timeout

// ============================================
// CONSTANTS
// ============================================

// Conversation steps - Enhanced flow
const STEPS = {
    IDLE: 'IDLE',                           // No active conversation
    AWAITING_LANGUAGE: 'AWAITING_LANGUAGE', // Asking language preference (first contact)
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

// API Helpers for Persistent State (MongoDB via Backend)
async function getPersistedState(vendorId, phoneNumber) {
    try {
        const response = await axios.get(`${FASTAPI_URL}/api/whatsapp/state/${phoneNumber}`, {
            params: { vendor_id: vendorId }
        });
        return response.data;
    } catch (error) {
        console.error(`[State] Error getting state for ${phoneNumber}:`, error.message);
        return { step: STEPS.IDLE, data: {} };
    }
}

async function updatePersistedState(vendorId, phoneNumber, step, data) {
    try {
        await axios.post(`${FASTAPI_URL}/api/whatsapp/state/${phoneNumber}`, {
            vendor_id: vendorId,
            step: step,
            data: data
        });
        const msg = `[State] Updated ${phoneNumber} to ${step}`;
        console.log(msg);
        logTrace(msg);
    } catch (error) {
        const errorMsg = `[State] Error updating state for ${phoneNumber}: ${error.message}`;
        console.error(errorMsg);
        logTrace(errorMsg);
    }
}

async function clearPersistedState(vendorId, phoneNumber) {
    try {
        await axios.delete(`${FASTAPI_URL}/api/whatsapp/state/${phoneNumber}`, {
            params: { vendor_id: vendorId }
        });
        console.log(`[State] Cleared state for ${phoneNumber}`);
    } catch (error) {
        console.error(`[State] Error clearing state for ${phoneNumber}:`, error.message);
    }
}

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

// Save on exit - DISABLED local file persistence
process.on('SIGINT', () => { process.exit(); });
process.on('SIGTERM', () => { process.exit(); });

// Auto-save interval removed - using MongoDB persistence in real-time.

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

            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`[Vendor ${vendorId.substring(0, 8)}] using WA v${version.join('.')}, isLatest: ${isLatest}`);

            const sock = makeWASocket({
                version,
                auth: authState,
                printQRInTerminal: false,
                browser: ['Thanni Canuuu', 'Chrome', '120.0.0'],
                // Improve stability
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: true
            });

            // Initialize client state immediately
            vendorClients.set(vendorId, {
                sock,
                qrCode: null,
                isConnected: false,
                user: null,
                lastActivity: Date.now(),
                initStartedAt: Date.now()
            });

            sock.ev.on('connection.update', async (update) => {
                try {
                    const { connection, lastDisconnect, qr } = update;
                    const client = vendorClients.get(vendorId);

                    // If client was removed (race condition), ignore updates
                    if (!client || client.sock !== sock) return;

                    logTrace(`[Vendor ${vendorId.substring(0, 8)}] Connection: ${connection} (hasQr: ${!!qr})`);
                    console.log(`[Vendor ${vendorId.substring(0, 8)}] Connection:`, { connection, hasQr: !!qr });

                    if (qr) {
                        client.qrCode = qr;
                        client.qrGeneratedAt = Date.now();
                        logTrace(`[Vendor ${vendorId.substring(0, 8)}] QR Code received`);
                        try {
                            fs.writeFileSync(`qr_${vendorId.substring(0, 8)}.txt`, qr);
                        } catch (e) { /* ignore file write errors */ }
                        console.log(`\n--- VENDOR ${vendorId.substring(0, 8)} QR CODE ---`);
                        qrcode.generate(qr, { small: true });
                    }

                    if (connection === 'close') {
                        const statusCode = lastDisconnect?.error?.output?.statusCode;
                        const errorMsg = lastDisconnect?.error?.message || 'No error message';
                        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                        client.isConnected = false;
                        client.qrCode = null;

                        logTrace(`[Vendor ${vendorId.substring(0, 8)}] Connection closed. Status: ${statusCode}, Error: ${errorMsg}, ShouldReconnect: ${shouldReconnect}`);
                        console.log(`[Vendor ${vendorId.substring(0, 8)}] ❌ Connection closed:`, { statusCode, errorMsg, shouldReconnect });

                        if (shouldReconnect) {
                            const attempts = incrementReconnectAttempts(vendorId);

                            if (attempts > RECONNECT_SETTINGS.maxRetries) {
                                console.error(`[Vendor ${vendorId.substring(0, 8)}] Max reconnection attempts reached. Cleaning up.`);
                                vendorClients.delete(vendorId);
                                return;
                            }

                            const delay = getReconnectDelay(vendorId);
                            console.log(`[Vendor ${vendorId.substring(0, 8)}] Reconnecting in ${delay / 1000}s (attempt ${attempts})`);

                            setTimeout(() => initVendorWhatsApp(vendorId).catch(e => {
                                console.error(`[Vendor ${vendorId.substring(0, 8)}] Reconnect failed:`, e.message);
                            }), delay);
                        } else {
                            console.log(`[Vendor ${vendorId.substring(0, 8)}] Logged out. Removing session.`);
                            client.isConnected = false;
                            vendorClients.delete(vendorId);

                            // Clean up auth folder
                            try {
                                if (fs.existsSync(authPath)) {
                                    fs.rmSync(authPath, { recursive: true, force: true });
                                }
                            } catch (e) { console.error('Error cleaning auth folder:', e); }
                        }
                    } else if (connection === 'open') {
                        console.log(`\n✅ [Vendor ${vendorId.substring(0, 8)}] WhatsApp connected!`);
                        client.qrCode = null;
                        client.isConnected = true;
                        client.user = sock.user || null;
                        client.connectedAt = Date.now();

                        // Reset reconnection attempts
                        resetReconnectAttempts(vendorId);
                    }
                } catch (err) {
                    console.error(`[Vendor ${vendorId.substring(0, 8)}] connection.update error:`, err.message);
                }
            });

            sock.ev.on('messages.upsert', async (m) => {
                try {
                    const { messages, type } = m;
                    logTrace(`[Upsert] Event Type: ${type} Count: ${messages.length} Vendor: ${vendorId}`);

                    if (type === 'notify' || type === 'append') {
                        for (const message of messages) {
                            if (!message?.message || !message?.key?.remoteJid) {
                                logTrace(`[Upsert] Invalid/empty message skipped`);
                                continue;
                            }

                            if (!message.key.fromMe) {
                                try {
                                    const isGroup = message.key.remoteJid.endsWith('@g.us');
                                    const fromMe = message.key.fromMe;
                                    const msgType = Object.keys(message.message || {})[0];

                                    if (!isGroup && !fromMe) {
                                        logTrace(`[DIRECT_RAW] From: ${message.key.remoteJid} Type: ${msgType} Content: ${JSON.stringify(message.message).substring(0, 500)}`);
                                    }

                                    logTrace(`[Upsert] ${isGroup ? 'GROUP' : 'DIRECT'} Msg from ${message.key.remoteJid} Type: ${msgType} Vendor: ${vendorId}`);
                                    console.log(`[Vendor ${vendorId.substring(0, 8)}] Msg:`, message.key.remoteJid);
                                    await handleIncomingMessage(vendorId, message);
                                } catch (err) {
                                    logTrace(`[Error] Message handler error: ${err.message}`);
                                    console.error(`[Vendor ${vendorId.substring(0, 8)}] Message handler error:`, err.message);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[Vendor ${vendorId.substring(0, 8)}] messages.upsert error:`, err.message);
                }
            });

            sock.ev.on('creds.update', saveCreds);

        } catch (error) {
            console.error(`[Vendor ${vendorId.substring(0, 8)}] Init error:`, error.message);
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

// Check if address is valid (not missing or "undefined")
function isAddressValid(customer) {
    if (!customer || !customer.address) return false;
    const addr = String(customer.address).toLowerCase().trim();
    return addr !== '' && addr !== 'undefined' && addr !== 'null';
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



// ============================================
// MESSAGE HANDLING
// ============================================

async function handleIncomingMessage(vendorId, message) {
    try {
        if (!message?.key?.remoteJid) {
            logTrace(`[Incoming] Skipping message with no remoteJid`);
            return;
        }

        const remoteJid = message.key.remoteJid;
        logTrace(`[Incoming] RAW: ${remoteJid}`);

        // Ignore group messages and newsletters
        if (remoteJid.endsWith('@g.us')) return;
        if (remoteJid.endsWith('@newsletter')) return;

        // Clean phone number for DB lookups (remove domain)
        const phoneNumber = remoteJid.split('@')[0];
        const msgContent = message.message;

        if (!msgContent) {
            logTrace(`[Incoming] No message content from ${remoteJid}`);
            return;
        }

        // Use robust extraction
        const messageText = getMessageText(msgContent).trim();

        logTrace(`[Incoming] From ${phoneNumber}: "${messageText}"`);
        console.log(`[Debug] Incoming from ${phoneNumber}: "${messageText}"`);

        if (!messageText && !msgContent?.buttonsResponseMessage && !msgContent?.listResponseMessage) {
            // Log full message for debugging if it's empty but has something
            if (msgContent && Object.keys(msgContent).length > 0) {
                console.log(`[Debug] Empty text but content:`, JSON.stringify(msgContent).substring(0, 200));
            }
            return;
        }

        // Check if delivery staff
        let staffInfo = null;
        try {
            staffInfo = await checkIfDeliveryStaff(vendorId, phoneNumber);
        } catch (e) {
            logTrace(`[Debug] Staff check failed for ${phoneNumber}: ${e.message}`);
        }
        logTrace(`[Debug] Staff check for ${phoneNumber}: ${staffInfo ? 'YES' : 'NO'}`);

        if (staffInfo && staffInfo.is_staff) {
            // Fix: Extract staff object correctly
            const staffObj = staffInfo.staff || staffInfo;
            try {
                // Try to handle as staff message first
                const handled = await handleDeliveryStaffMessage(vendorId, remoteJid, messageText, staffObj);

                // If handled (was a staff command like '1', '2', '3'), stop here
                if (handled) {
                    logTrace(`[Incoming] Handled as staff command`);
                    return;
                }
            } catch (staffErr) {
                logTrace(`[Error] Staff handler failed: ${staffErr.message}`);
                console.error('[Error] Staff handler:', staffErr.message);
            }
            // If NOT handled (e.g., "Hi"), proceed to customer flow below
            logTrace(`[Incoming] Staff number but not a command, falling back to customer`);
            console.log(`[Validation] Staff message "${messageText}" not a command, falling back to customer flow`);
        }

        logTrace(`[Incoming] Calling handleCustomerConversation...`);

        // Handle customer conversation
        await handleCustomerConversation(vendorId, remoteJid, messageText);

    } catch (error) {
        logTrace(`[Error] handleIncomingMessage: ${error.message}`);
        console.error('[Error] handleIncomingMessage:', error.message);
    }
}

// ============================================
// DELIVERY STAFF MESSAGE HANDLING
// Enhanced with structured responses
// ============================================

async function handleDeliveryStaffMessage(vendorId, remoteJid, messageText, staffInfo) {
    const client = vendorClients.get(vendorId);
    if (!client?.sock) return false;

    const jid = remoteJid;
    const phoneNumber = remoteJid.split('@')[0];
    const text = messageText.toLowerCase().trim();

    // Send helper function with full safety
    const send = async (msg) => {
        try {
            if (!msg || !client?.sock) return;
            if (client.sock.authState?.creds?.me?.id) {
                await client.sock.sendMessage(jid, { text: msg });
            } else {
                logTrace(`[Staff] Socket not authenticated for ${vendorId.substring(0, 8)}, skipping send`);
            }
        } catch (e) {
            logTrace(`[Error] Staff send failed to ${jid}: ${e.message}`);
            console.error(`[Error] Staff send failed:`, e.message);
        }
    };

    // Find staff's latest pending order
    let pendingOrder = null;
    const staff_id = staffInfo.staff_id || staffInfo.staff?.staff_id;

    if (staff_id) {
        try {
            const response = await axios.get(`${FASTAPI_URL}/api/delivery-staff/${staff_id}/orders`, {
                params: {
                    vendor_id: vendorId,
                    status: 'pending'
                }
            });
            if (response.data && response.data.length > 0) {
                pendingOrder = response.data[0];
            }
        } catch (error) {
            logTrace(`[Staff] API Error for ${staff_id}: ${error.message}`);
            console.error('[API] Error fetching staff orders:', error.message);
        }
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
            return true; // Handled as staff command

        } catch (error) {
            await send(`❌ Error updating status: ${error.message}`);
            return true; // Handled (even with error)
        }
    }

    // Handle "done ORDER_ID" format
    const doneMatch = text.match(/^(done|delivered)\s+(\S+)/i);
    if (doneMatch) {
        const orderId = doneMatch[2].toUpperCase();
        try {
            await axios.post(`${FASTAPI_URL}/api/orders/${orderId}/delivery/complete`, null, {
                params: { vendor_id: vendorId, payment_status: PAYMENT_STATUS.PENDING }
            });
            await send(`✅ Order ${orderId} marked as delivered!`);
        } catch (error) {
            await send(`❌ Could not update ${orderId}: ${error.response?.data?.detail || error.message}`);
        }
        return true;
    }

    // Handle "paid ORDER_ID cash/upi" format
    const paidMatch = text.match(/^paid\s+(\S+)\s*(cash|upi)?/i);
    if (paidMatch) {
        const orderId = paidMatch[1].toUpperCase();
        const method = paidMatch[2]?.toLowerCase() || 'cash';
        const paymentStatus = method === 'upi' ? PAYMENT_STATUS.PAID_UPI : PAYMENT_STATUS.PAID_CASH;
        try {
            await axios.post(`${FASTAPI_URL}/api/orders/${orderId}/delivery/complete`, null, {
                params: {
                    vendor_id: vendorId,
                    payment_status: paymentStatus
                }
            });
            await send(`✅ ${orderId} marked PAID (${method})!`);
        } catch (error) {
            await send(`❌ Could not update ${orderId}: ${error.response?.data?.detail || error.message}`);
        }
        return true;
    }

    // Explicit Help/Status command
    if (['help', 'status', 'commands'].includes(text)) {
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
        return true;
    }
    // Not a staff command -> Fall through to customer flow
    return false;
}

// Send payment request to customer after unpaid delivery (REFINED)
async function sendCustomerPaymentRequest(vendorId, customerPhone, order) {
    const client = vendorClients.get(vendorId);
    if (!client?.sock) return;

    const jid = customerPhone.includes('@') ? customerPhone : `${customerPhone}@s.whatsapp.net`;

    // User requested: "Once the delivery boy marked as delivered only send deliverd to the customer, 
    // if the payment is pending mention that only. other wise dont give any other option."

    let message = `Hi 👋 Your order ${order.order_id} has been delivered! 🚚\n\n`;

    const isUnpaid = order.payment_status === 'pending' || order.payment_status === 'delivered_unpaid';

    if (isUnpaid) {
        message += `⏳ *Payment Status: Pending*\n` +
            `Amount Due: ₹${order.amount}\n\n` +
            `Please clear the payment with our staff or via UPI. Thank you! 🙏`;
    } else {
        message += `✅ *Payment Status: Paid*\n\n` +
            `Thank you for choosing Thanni Canuuu! 💧`;
    }

    try {
        if (client?.sock && client.sock.authState?.creds?.me?.id) {
            await client.sock.sendMessage(jid, { text: message });
            logTrace(`[Notification] Delivery notification sent to ${jid}`);
        } else {
            logTrace(`[Notification] Skipped - Socket not ready for ${jid}`);
        }
    } catch (e) {
        logTrace(`[Error] Failed to send delivery notification: ${e.message}`);
    }
}

// ============================================
// CUSTOMER CONVERSATION FLOW
// Enhanced with smart follow-up handling
// ============================================

async function handleCustomerConversation(vendorId, remoteJid, messageText) {
    const client = vendorClients.get(vendorId);
    if (!client?.sock) return;

    const jid = remoteJid;
    const phoneNumber = remoteJid.split('@')[0];
    const text = messageText.toLowerCase().trim();

    // Get persisted state from MongoDB (Phase 4)
    let session = await getPersistedState(vendorId, phoneNumber);
    let lang = session.data?.lang || 'ta';

    logTrace(`[CustomerFlow] From: ${phoneNumber} Step: ${session.step} Text: "${text}" Vendor: ${vendorId.substring(0, 8)}`);

    // Phase 5: Log initial state
    console.log(`[Flow] Current State: ${session.step}`);

    // Update activity locally (will be saved on next updatePersistedState)
    session.lastActivity = Date.now();
    logTrace(`[Customer] Flow: ${phoneNumber} Step: ${session.step} Text: "${text}"`);

    // Helper to update state in DB
    const updateState = async (newStep, newData = null) => {
        const step = newStep || session.step;
        const data = newData || session.data;
        console.log(`[Flow] STATE UPDATED TO: ${step} for ${phoneNumber}`);
        await updatePersistedState(vendorId, phoneNumber, step, data);
    };

    // Send helper function
    const send = async (msg) => {
        try {
            if (!client?.sock || !msg) return;
            logTrace(`[Outgoing] To ${jid}: "${msg.substring(0, 50)}..."`);
            if (client.sock.authState?.creds?.me?.id) {
                await client.sock.sendMessage(jid, { text: msg });
                logTrace(`[Outgoing] SENT successfully to ${jid}`);
            } else {
                logTrace(`[Error] Socket not authenticated/ready for ${vendorId}`);
            }
        } catch (e) {
            logTrace(`[Error] Send failed to ${jid}: ${e.message}`);
            console.error(`[Error] Send failed to ${jid}:`, e.message);
        }
    };

    // ============================================
    // CUSTOMER DATA & LANGUAGE
    // ============================================
    let customer = await getCustomerByPhone(vendorId, phoneNumber);
    lang = (customer && customer.preferred_language) || session.data.lang || 'en';
    session.data.lang = lang;

    // ============================================
    // STATE MACHINE (Phases 3 & 7)
    // ============================================

    // Handle Language Prompt (Start of Flow)
    if (session.step === STEPS.IDLE && (!customer || !customer.preferred_language)) {
        await updateState(STEPS.AWAITING_LANGUAGE, { ...session.data, langSet: false });
        await send(getMessage('en', 'languagePrompt'));
        return;
    }

    // Process State Transitions
    switch (session.step) {

        case STEPS.AWAITING_LANGUAGE:
            let selectedLang = null;
            if (text === '1' || text.includes('tamil') || text.includes('தமிழ்')) {
                selectedLang = 'ta';
            } else if (text === '2' || text.includes('english')) {
                selectedLang = 'en';
            }

            if (selectedLang) {
                session.data.lang = selectedLang;
                session.data.langSet = true;

                // Save language preference to backend
                try {
                    await axios.put(
                        `${FASTAPI_URL}/api/customers/${phoneNumber}/language`,
                        { preferred_language: selectedLang, vendor_id: vendorId }
                    );
                } catch (e) { console.error('[i18n] Language save failed', e.message); }

                // Check if we need name or address (new or incomplete customer)
                if (!customer || !customer.name || customer.name === 'Customer') {
                    await updateState(STEPS.AWAITING_NAME, session.data);
                    await send(getMessage(selectedLang, 'welcomeNew'));
                } else if (!isAddressValid(customer)) {
                    await updateState(STEPS.AWAITING_ADDRESS, { ...session.data, name: customer.name });
                    await send(getMessage(selectedLang, 'askAddress', customer.name));
                } else {
                    await updateState(STEPS.IDLE, session.data);
                    // Fall through to IDLE logic for returning customer
                    await handleCustomerConversation(vendorId, remoteJid, 'hi'); // Re-trigger greeting
                }
            } else {
                await send(getMessage('en', 'languagePrompt'));
            }
            return;

        case STEPS.AWAITING_NAME:
            if (text.length < 2) {
                await send(getMessage(lang, 'welcomeNew'));
                return;
            }
            session.data.name = messageText.trim();
            await updateState(STEPS.AWAITING_ADDRESS, session.data);
            await send(getMessage(lang, 'askAddress', session.data.name));
            return;

        case STEPS.AWAITING_ADDRESS:
            if (text.length < 5) {
                await send(getMessage(lang, 'askAddress', session.data.name));
                return;
            }
            session.data.address = messageText.trim();

            // Create customer record in DB
            customer = await createCustomer(vendorId, phoneNumber, session.data.name, session.data.address);

            await updateState(STEPS.AWAITING_CAN_TYPE, session.data);
            await send(getMessage(lang, 'addressSaved') + '\n\n' + getMessage(lang, 'chooseLitre', '...'));
            return;

        case STEPS.IDLE:
            // Check for order/status keywords
            if (['hi', 'hello', 'hey', 'start', 'வணக்கம்', 'hi', 'start'].includes(text)) {
                const activeOrderInfo = await getCustomerActiveOrder(vendorId, phoneNumber);

                if (activeOrderInfo.has_active_order) {
                    await updateState(STEPS.AWAITING_MENU_CHOICE, session.data);
                    const order = activeOrderInfo.order;
                    await send(getMessage(lang, 'activeOrderMenu',
                        customer?.name || (lang === 'ta' ? 'அன்பரே' : 'there'),
                        order.quantity,
                        order.litre_size,
                        order.amount,
                        getMessage(lang, 'localizeStatus', order.status)
                    ));
                } else {
                    // Check if address is missing/undefined for returning customer
                    if (!isAddressValid(customer)) {
                        await updateState(STEPS.AWAITING_ADDRESS, { ...session.data, name: customer?.name });
                        await send(getMessage(lang, 'askAddress', customer?.name || (lang === 'ta' ? 'அன்பரே' : 'Customer')));
                        return;
                    }

                    // Sync customer data to session
                    session.data.name = customer.name;
                    session.data.address = customer.address;

                    await updateState(STEPS.AWAITING_CAN_TYPE, session.data);
                    await send(`${getMessage(lang, 'welcome', customer?.name)}\n\n${getMessage(lang, 'chooseLitre', '...')}`);
                }
                return;
            } else if (['order', 'water', 'can', 'ஆர்டர்', 'தண்ணீர்'].includes(text)) {
                if (!isAddressValid(customer)) {
                    await updateState(STEPS.AWAITING_ADDRESS, { ...session.data, name: customer?.name });
                    await send(getMessage(lang, 'askAddress', customer?.name || (lang === 'ta' ? 'அன்பரே' : 'Customer')));
                    return;
                }

                // Sync customer data to session
                session.data.name = customer.name;
                session.data.address = customer.address;

                await updateState(STEPS.AWAITING_CAN_TYPE, session.data);
                await send(getMessage(lang, 'chooseLitre', '...'));
                return;
            } else if (['status', 'check', 'நிலை'].includes(text)) {
                const orderInfo = await getCustomerLatestOrder(vendorId, phoneNumber);
                if (orderInfo.order) {
                    const order = orderInfo.order;
                    await send(getMessage(lang, 'orderStatus',
                        order.order_id,
                        `${order.quantity} x ${order.litre_size}L`,
                        getMessage(lang, 'localizeStatus', order.status)
                    ));
                } else {
                    await send(getMessage(lang, 'noRecentOrders'));
                }
                return;
            }
            break;

        case STEPS.AWAITING_MENU_CHOICE:
            if (text === '1') {
                const orderInfo = await getCustomerLatestOrder(vendorId, phoneNumber);
                if (orderInfo.order) {
                    const order = orderInfo.order;
                    await send(getMessage(lang, 'orderStatus',
                        order.order_id,
                        `${order.quantity} x ${order.litre_size}L`,
                        getMessage(lang, 'localizeStatus', order.status),
                        order.amount
                    ));
                }
                await updateState(STEPS.IDLE, session.data);
            } else if (text === '2') {
                await updateState(STEPS.AWAITING_CAN_TYPE, session.data);
                await send(getMessage(lang, 'chooseLitre', '...'));
            } else {
                await send(getMessage(lang, 'menuChoicePrompt'));
            }
            return;

        case STEPS.AWAITING_CAN_TYPE:
            const prices = await getProductPrices(vendorId);
            if (text.includes('20') || text === '1') {
                session.data.canType = '20';
                await updateState(STEPS.AWAITING_QTY_20L, session.data);
                await send(getMessage(lang, 'chooseQuantity', 20, prices['20L'] || 50, '...'));
            } else if (text.includes('25') || text === '2') {
                session.data.canType = '25';
                await updateState(STEPS.AWAITING_QTY_25L, session.data);
                await send(getMessage(lang, 'chooseQuantity', 25, prices['25L'] || 65, '...'));
            } else {
                await send(getMessage(lang, 'chooseLitre', '...'));
            }
            return;

        case STEPS.AWAITING_QTY_20L:
        case STEPS.AWAITING_QTY_25L:
            const qty = parseInt(text);
            const litre = session.step === STEPS.AWAITING_QTY_20L ? 20 : 25;
            if (isNaN(qty) || qty < 1 || qty > 10) {
                await send(getMessage(lang, 'invalidQuantity'));
                return;
            }

            session.data[litre === 20 ? 'qty20L' : 'qty25L'] = qty;
            const itemPrices = await getProductPrices(vendorId);
            const total = qty * (itemPrices[`${litre}L`] || (litre === 20 ? 50 : 65));

            // Final check on address before summary
            if (!session.data.address || session.data.address === 'undefined') {
                if (customer && isAddressValid(customer)) {
                    session.data.address = customer.address;
                } else {
                    await updateState(STEPS.AWAITING_ADDRESS, { ...session.data, name: session.data.name || customer?.name });
                    await send(getMessage(lang, 'askAddress', session.data.name || customer?.name || 'Customer'));
                    return;
                }
            }

            await updateState(STEPS.AWAITING_CONFIRM, session.data);
            await send(getMessage(lang, 'orderSummary', qty, litre, total, session.data.address));
            return;

        case STEPS.AWAITING_CONFIRM:
            if (['yes', 'y', 'confirm', 'ok'].includes(text)) {
                try {
                    const finalPrices = await getProductPrices(vendorId);
                    const finalItems = [];
                    if (session.data.qty20L) finalItems.push({ litre_size: 20, quantity: session.data.qty20L, price_per_can: finalPrices['20L'] });
                    if (session.data.qty25L) finalItems.push({ litre_size: 25, quantity: session.data.qty25L, price_per_can: finalPrices['25L'] });

                    const order = await createOrder(vendorId, {
                        customer_phone: phoneNumber,
                        customer_name: session.data.name || customer?.name || 'Customer',
                        customer_address: session.data.address || customer?.address || 'Address missing',
                        items: finalItems
                    });

                    console.log(`[Order] Success Response:`, order);
                    await send(getMessage(lang, 'orderConfirmedFinal', order.order_id, order.total_amount));
                    await clearPersistedState(vendorId, phoneNumber);
                } catch (e) {
                    const errorDetail = e.response?.data?.detail || e.message;
                    logTrace(`[Error] Order creation failed for ${phoneNumber}: ${errorDetail}`);
                    console.error(`[Order] Creation failed:`, errorDetail);

                    // Specific message for no staff
                    if (errorDetail.includes('staff')) {
                        await send(getMessage(lang, 'noStaff'));
                    } else if (errorDetail.includes('stock')) {
                        await send(getMessage(lang, 'outOfStock'));
                    } else {
                        await send(getMessage(lang, 'orderFailed') + (errorDetail ? `\n\nError: ${errorDetail}` : ''));
                    }
                    await updateState(STEPS.IDLE, session.data);
                }
            } else if (['no', 'n', 'cancel'].includes(text)) {
                await send(getMessage(lang, 'orderCancelled'));
                await clearPersistedState(vendorId, phoneNumber);
            } else {
                await send(getMessage(lang, 'yesNoPrompt'));
            }
            return;
    }

    // Default catch-all
    if (session.step !== STEPS.IDLE) {
        await send(getMessage(lang, 'didNotUnderstand'));
    }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
    let connectedCount = 0;
    for (const [, client] of vendorClients.entries()) {
        if (client.isConnected) connectedCount++;
    }
    res.json({
        status: 'ok',
        activeVendors: vendorClients.size,
        connectedVendors: connectedCount,
        uptime: process.uptime(),
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
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

    // If no client exists, start initialization
    if (!client) {
        console.log(`[QR] No client for ${vendorId.substring(0, 8)}, starting init...`);
        initVendorWhatsApp(vendorId).catch(err => console.error(`[QR] Init failed for ${vendorId.substring(0, 8)}:`, err.message));
        return res.json({ qr: null, status: 'initializing', message: 'Starting WhatsApp initialization... Please retry in a few seconds.' });
    }

    if (client.isConnected) {
        return res.json({ qr: null, connected: true, status: 'connected' });
    }

    // If client exists but has stale state (no QR, no connection, init started > 30s ago)
    const initAge = Date.now() - (client.initStartedAt || 0);
    const qrAge = Date.now() - (client.qrGeneratedAt || 0);
    if (!client.qrCode && !client.isConnected && initAge > 30000) {
        console.log(`[QR] Client stale for ${vendorId.substring(0, 8)} (age: ${Math.round(initAge / 1000)}s), re-initializing...`);
        // Clean up stale client and retry
        try { client.sock?.end(undefined); } catch (e) { }
        vendorClients.delete(vendorId);
        resetReconnectAttempts(vendorId);
        initVendorWhatsApp(vendorId).catch(err => console.error(`[QR] Re-init failed:`, err.message));
        return res.json({ qr: null, status: 'initializing', message: 'Reconnecting... Please retry in a few seconds.' });
    }

    if (!client.qrCode) {
        return res.json({ qr: null, status: 'pending', message: 'Generating QR code... Please wait.' });
    }

    // QR codes expire after ~60s, if older than 45s, flag it
    if (qrAge > 45000) {
        return res.json({ qr: client.qrCode, status: 'ready', warning: 'QR may be expiring soon, scan quickly or refresh.' });
    }

    res.json({ qr: client.qrCode, status: 'ready' });
});

// Reset WhatsApp session (Force Logout & Clear Audio Folders)
app.post('/reset/:vendorId', verifyApiKey, async (req, res) => {
    const { vendorId } = req.params;
    console.log(`[Reset] Force reset requested for vendor ${vendorId}`);

    const client = vendorClients.get(vendorId);
    if (client?.sock) {
        try {
            client.sock.logout();
            client.sock.end(undefined);
        } catch (e) { }
    }

    vendorClients.delete(vendorId);

    // Delete session folder
    const authPath = path.join(__dirname, `auth_info_${vendorId}`);
    try {
        if (fs.existsSync(authPath)) {
            // Give a small delay for file handles to release
            await new Promise(resolve => setTimeout(resolve, 500));
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log(`[Reset] Deleted session folder: ${authPath}`);
        }
    } catch (e) {
        console.error(`[Reset] Error deleting folder: ${e.message}`);
        return res.status(500).json({ error: 'Failed to delete session files. They might be in use.' });
    }

    res.json({ success: true, message: 'Session reset. You can now re-initialize.' });
});

// Initialize WhatsApp for a vendor (protected)
app.post('/init/:vendorId', verifyApiKey, async (req, res) => {
    const { vendorId } = req.params;

    if (vendorClients.has(vendorId)) {
        return res.json({ success: true, message: 'Already initialized' });
    }

    await initVendorWhatsApp(vendorId);
    res.json({ success: true, message: 'WhatsApp initialization started' });
});

// Disconnect WhatsApp
app.post('/disconnect/:vendorId', verifyApiKey, async (req, res) => {
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
app.post('/reconnect/:vendorId', verifyApiKey, async (req, res) => {
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
app.post('/test/simulate-message/:vendorId', verifyApiKey, async (req, res) => {
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
app.post('/send/:vendorId', verifyApiKey, async (req, res) => {
    const { vendorId } = req.params;
    const { to, message } = req.body;
    const client = vendorClients.get(vendorId);

    if (!client?.sock || !client.isConnected) {
        return res.status(400).json({ success: false, error: 'Not connected' });
    }

    try {
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        if (client.sock.authState?.creds?.me?.id) {
            await client.sock.sendMessage(jid, { text: message });
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, error: 'Socket not authenticated' });
        }
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

// Note: Duplicate /health removed - using the one at line 1112

// Legacy endpoints
app.get('/status', (req, res) => res.json({ message: 'Use /status/:vendorId', activeVendors: vendorClients.size }));
app.get('/qr', (req, res) => res.json({ message: 'Use /qr/:vendorId', activeVendors: vendorClients.size }));

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, async () => {
    console.log(`\n🚀 WhatsApp Service running on port ${PORT}`);
    console.log(`📡 Backend: ${FASTAPI_URL}`);

    // Auto-load existing sessions
    try {
        const files = fs.readdirSync(__dirname);
        const authFolders = files.filter(f => {
            if (!f.startsWith('auth_info_')) return false;
            const fullPath = path.join(__dirname, f);
            try {
                return fs.statSync(fullPath).isDirectory();
            } catch (e) {
                return false;
            }
        });

        console.log(`\n[Startup] Found ${authFolders.length} existing sessions to restore...`);

        for (const folder of authFolders) {
            const vendorId = folder.replace('auth_info_', '');
            // Skip test vendors
            if (vendorId === 'test-vendor') {
                console.log(`[Startup] Skipping test vendor session`);
                continue;
            }
            console.log(`[Startup] Restoring session for vendor ${vendorId.substring(0, 8)}...`);
            // Add delay between inits to avoid CPU spike
            await new Promise(resolve => setTimeout(resolve, 3000));
            try {
                await initVendorWhatsApp(vendorId);
                console.log(`[Startup] ✅ Session restored for ${vendorId.substring(0, 8)}`);
            } catch (err) {
                console.error(`[Startup] ❌ Failed to restore ${vendorId.substring(0, 8)}:`, err.message);
                // Don't let one failure stop others
            }
        }
        console.log(`[Startup] Session restore complete. Active vendors: ${vendorClients.size}`);
    } catch (error) {
        console.error('[Startup] Error auto-loading sessions:', error.message);
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

