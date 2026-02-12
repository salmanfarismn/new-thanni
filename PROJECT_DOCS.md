# ThanniCanuuu - Technical Specification & AI Training Data

This document provides a deep-dive analysis of the ThanniCanuuu ecosystem, covering the micro-level architecture, API signatures, database schemas, and critical business flows.

---

## 1. System Ecosystem & Deployment
ThanniCanuuu is a distributed system consisting of three primary services:
1.  **Backend (API Service):** A high-performance FastAPI server managing business logic and multi-tenant data.
2.  **Frontend (React Web/Mobile):** A mobile-optimized React application serving both Vendor Dashboards and Delivery Agent Interfaces.
3.  **WhatsApp Service:** A Node.js microservice built on the Baileys library that acts as a bridge between the WhatsApp network and the Backend API.

---

## 2. Technical Stack Detail

### **Backend (Python)**
- **Framework:** FastAPI (`uvicorn` as ASGI server).
- **Database Wrapper:** `motor` (Asynchronous driver for MongoDB).
- **Auth:** `PyJWT` for token generation and `passlib` (bcrypt) for PIN hashing.
- **Async Communication:** `httpx` for calling the WhatsApp microservice.
- **Logistics:** Sequential notification queue using `asyncio.deque` and a custom background worker.

### **Frontend (JavaScript)**
- **Base:** Create React App (CRA) with **Craco** for config overrides.
- **Design:** **Tailwind CSS** using a curated HSL color palette (Slate, Emerald, Blue, Rose).
- **Routing:** **React Router Dom (v7)** with separate Layout systems for Vendors and Agents.
- **Interceptors:** Axios request interceptors inject `Bearer` tokens; response interceptors handle `401 Unauthorized` by flushing local storage.

### **Database (MongoDB)**
- **Collections:** `vendors`, `orders`, `customers`, `delivery_staff`, `delivery_shifts`, `stock`, `price_settings`, `customer_states`, `vendor_sessions`.

---

## 3. Detailed Database Schema (BSON Structure)

### **`orders`**
- `order_id` (String, PK): e.g., "ORD20250212103001"
- `vendor_id` (String, Indexed): Multi-tenant ownership.
- `customer_phone` (String): Normalized 10/12 digits.
- `status` (Enum): `pending`, `assigned`, `out_for_delivery`, `delivered`, `cancelled`.
- `payment_status` (Enum): `pending`, `paid_cash`, `paid_upi`, `upi_pending`, `cash_due`, `delivered_unpaid`.
- `delivery_staff_id` (String): ID of the assigned agent.
- `amount` (Float): Total order value.
- `delivery_photo_url` (String, Optional): Path to evidence photo on server.
- `empty_cans_collected` (Integer): Count of cans returned.

### **`stock`**
- `date` (String, ISO): e.g., "2026-02-12"
- `vendor_id` (String)
- `total_stock` (Integer): Initial inventory for the day.
- `available_stock` (Integer): `total_stock - sum(active_orders)`.
- `orders_count` (Integer): Continuous incrementer for today's orders.

---

## 4. API Reference (Core Endpoints)

### **Authentication**
- `POST /api/auth/register`: Vendor registration.
- `POST /api/auth/login`: Returns JWT and vendor profile.
- `GET /api/auth/me`: Validates session and returns user role/profile.

### **Vendor Dashboard**
- `GET /api/dashboard/metrics`: Summary of today's sales, stock, and revenue.
- `GET /api/dashboard/sales`: Date-range filtered sales reports (normalized to IST).
- `GET /api/orders`: List all orders for the vendor with status/agent filters.
- `POST /api/orders/create`: Manual order creation from dashboard.

### **Delivery Agent Workspace**
- `GET /api/agent/orders/active`: List assigned orders for the logged-in agent.
- `GET /api/agent/history`: Timeline of completed/cancelled tasks.
- `POST /api/agent/orders/{id}/complete`: Multi-part form data upload including `delivery_photo`.
- `POST /api/agent/report-damage`: Submit returns/damage with evidence.

### **WhatsApp Bridge (Internal/Secure)**
- `POST /api/whatsapp/webhook`: Handles incoming messages from the Node.js service.
- `POST /api/whatsapp/message`: Outreach endpoint for sending automated notifications.

---

## 5. Critical Business Flows

### **A. The WhatsApp Order Flow (Self-Service)**
1.  **Initiation:** Customer sends "hi".
2.  **State Check:** System checks `customer_states` collection. If `idle`, asks for Name/Address.
3.  **Litre Selection:** Bot sends interactive buttons/message for 20L vs 25L.
4.  **Quantity:** Bot validates stock and asks for count (1-10).
5.  **Placement:** Order is created, `staff` is auto-assigned via shift logic, and `stock` is decremented.
6.  **Notification:** Backend triggers a WhatsApp alert to the assigned Agent.

### **B. Shift Assignment Logic**
- **Morning Shift:** 6:00 AM to 2:00 PM (14:00).
- **Evening Shift:** 2:00 PM to 10:00 PM (22:00).
- **Process:** System queries `delivery_shifts` for the current `date` and the current `shift` name. It selects the agent with the **lowest `active_orders_count`** to ensure load balancing.

---

## 6. Current Issues & Developer Caveats

### **1. Storage Persistence (Critical)**
The system currently writes files to `backend/static/uploads`.
- **Hobby Hosting:** On platforms like Render or Heroku, these files are deleted every 24 hours.
- **Proposed Solution:** Integration with Cloudinary or AWS S3 is pending.

### **2. Notification Reliability**
The `notification_queue` is memory-resident. If the backend process crashes, the queue is lost.
- **Proposed Solution:** Implement Redis-backed Celery or BullMQ for Node.js.

### **3. Multi-Tenancy Data Isolation**
Every database operation MUST include `vendor_id`.
- **Current Status:** Verified in `server.py` and `agent.py` via `Depends(get_current_vendor_id)`.
- **Risk:** Developers must never use `db.orders.find_one({"order_id": ...})` without also checking the `vendor_id`.

---

## 7. Vision Roadmap
- **I18n Localization:** Support for Tamil (தமிழ்), Hindi (हिन्दी), etc.
- **Geo-fencing:** Tracking agent location via the Capacitor-based Android app.
- **Subscription Management:** Automated "Standing Orders" where customers receive cans on specific days weekly.
