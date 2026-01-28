---
description: WhatsApp Order Flow Testing Guide
---

# WhatsApp Order Flow Testing Guide

This document describes how to test the stateful WhatsApp order flow for Thanni Canuuu.

## Prerequisites

1. MongoDB running locally or configured in `.env`
2. Backend server running on port 8000
3. WhatsApp service running on port 3001
4. WhatsApp connected (QR code scanned)

## Starting the Services

// turbo-all

1. Start MongoDB (if not running):
```bash
mongod
```

2. Start the backend:
```bash
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

3. Start the WhatsApp service:
```bash
cd whatsapp-service
npm run start
```

4. Scan the QR code with your WhatsApp

## Test Scenarios

### 1. New Customer Flow

Send a message from a phone number not in the database:

**Expected Flow:**
1. Bot greets: "Hi 👋 Welcome to Thanni Canuuu! 💧..."
2. Bot asks: "May I know your name?"
3. Customer sends name
4. Bot asks for delivery address
5. Customer sends address
6. Bot shows prices and asks for 20L quantity
7. Customer enters 20L quantity
8. Bot asks for 25L quantity
9. Customer enters 25L quantity
10. Bot shows order summary with YES/NO confirmation
11. Customer confirms with YES
12. Order is created and confirmed

### 2. Returning Customer Flow

Send a message from a phone number that exists in the database:

**Expected Flow:**
1. Bot greets by name: "Hi [Name] 👋 Welcome back to Thanni Canuuu! 💧"
2. Bot shows prices directly
3. Bot asks for 20L quantity
4. (Continues with order flow)

### 3. Out of Stock Scenario

When inventory is depleted:

**Expected Flow:**
1. Customer completes order selection
2. Bot shows order summary with note: "Today's stock is fully booked. Your order will be scheduled for tomorrow morning."
3. Customer confirms
4. Order is created with `is_tomorrow_order: true` and `delivery_date: <tomorrow>`

## API Endpoints for Testing

### Check Customer
```bash
curl http://localhost:8000/api/customers/{phone_number}
```

### Get Product Prices
```bash
curl http://localhost:8000/api/products/prices
```

### Check Inventory
```bash
curl -X POST http://localhost:8000/api/inventory/check \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5}'
```

### Get Tomorrow's Orders
```bash
curl http://localhost:8000/api/orders/tomorrow
```

### Get Delivery Queue (with tomorrow's orders first)
```bash
curl http://localhost:8000/api/orders/delivery-queue
```

### View Active Conversation Sessions
```bash
curl http://localhost:3001/sessions
```

## Conversation States

The bot tracks these states for each phone number:

- `START` - Initial state
- `AWAITING_NAME` - Waiting for customer name
- `AWAITING_ADDRESS` - Waiting for delivery address
- `AWAITING_ORDER` - Ready to take order
- `AWAITING_20L_QTY` - Waiting for 20L quantity
- `AWAITING_25L_QTY` - Waiting for 25L quantity
- `AWAITING_CONFIRMATION` - Waiting for YES/NO

Sessions expire after 30 minutes of inactivity.

## Troubleshooting

### Bot not responding
1. Check WhatsApp connection: `curl http://localhost:3001/status`
2. Check if backend is running: `curl http://localhost:8000/health`
3. Check console logs in whatsapp-service terminal

### Order not created
1. Verify delivery staff exists and is active
2. Check stock availability
3. Review backend logs for errors

### Session stuck
Clear the session: `curl -X DELETE http://localhost:3001/sessions/{phone_number}`
