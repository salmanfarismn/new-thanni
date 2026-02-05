# Multi-Vendor PIN-Based Authentication System

## Overview

This document describes the PIN-based authentication system implemented for Thanni Canuuu, enabling multi-vendor support with secure session management.

## Architecture

- **Backend**: FastAPI (Python) on port 8000
- **Frontend**: React on port 3000
- **Database**: MongoDB (existing)
- **WhatsApp Service**: Node.js + Baileys on port 3001

## Features

### 1. Vendor Registration
- Business name and phone number
- 4-6 digit PIN (bcrypt hashed)
- Unique phone validation

### 2. Vendor Login
- Phone + PIN authentication
- JWT token generation (7-day expiry)
- Multi-device support
- Device fingerprinting

### 3. Session Management
- View all active sessions
- Remote device logout
- Session expiry tracking
- Last active timestamps

### 4. Data Isolation
- Each vendor sees only their own data
- Orders, customers, stock filtered by vendor_id

---

## API Endpoints

### Authentication Routes (`/api/auth/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new vendor | No |
| POST | `/login` | Login and get JWT token | No |
| GET | `/me` | Get current vendor profile | Yes |
| GET | `/sessions` | List all active sessions | Yes |
| DELETE | `/sessions/{id}` | Revoke a session | Yes |
| POST | `/logout` | Logout current session | Yes |
| POST | `/change-pin` | Change vendor PIN | Yes |
| PATCH | `/profile` | Update vendor profile | Yes |

### Request/Response Examples

#### Register
```json
POST /api/auth/register
{
    "business_name": "Kumar Water Supply",
    "phone": "+919876543210",
    "pin": "1234"
}

Response:
{
    "success": true,
    "message": "Vendor 'Kumar Water Supply' registered successfully."
}
```

#### Login
```json
POST /api/auth/login
{
    "phone": "+919876543210",
    "pin": "1234",
    "device_name": "Windows PC"
}

Response:
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 604800,
    "vendor": {
        "id": "...",
        "business_name": "Kumar Water Supply",
        "phone": "+919876543210",
        "is_active": true,
        "created_at": "2026-02-03T14:00:00Z"
    }
}
```

---

## Files Created/Modified

### Backend

| File | Purpose |
|------|---------|
| `backend/auth.py` | PIN hashing, JWT utilities |
| `backend/schemas.py` | Pydantic validation schemas |
| `backend/routers/__init__.py` | Router package init |
| `backend/routers/auth.py` | Authentication endpoints |
| `backend/seed_vendor.py` | Initial vendor setup |
| `backend/.env` | Added SECRET_KEY, ACCESS_TOKEN_EXPIRE_DAYS |
| `backend/server.py` | Added auth router import |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/api/axios.js` | Axios instance with auth interceptors |
| `frontend/src/pages/Login.js` | Login page component |
| `frontend/src/pages/Register.js` | Registration page component |
| `frontend/src/components/PrivateRoute.js` | Route protection component |
| `frontend/src/pages/Settings/Devices.js` | Session management page |
| `frontend/src/App.js` | Updated routes |
| `frontend/src/context/AppContext.js` | Updated to use new axios |
| `frontend/src/pages/Settings.js` | Added Security tab |

### WhatsApp Service

| File | Purpose |
|------|---------|
| `whatsapp-service/index.js` | Added vendor_id to orders |

---

## Default Credentials

After running `seed_vendor.py`:

```
Phone: +919876543210
PIN:   1234
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
# Backend
cd backend
pip install passlib[bcrypt] python-jose[cryptography]

# Frontend (already installed)
cd frontend
npm install
```

### 2. Run Vendor Seed Script

```bash
cd backend
python seed_vendor.py
```

This will:
- Create the default vendor
- Update existing data with vendor_id
- Create database indexes

### 3. Restart Services

```bash
# Backend
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload

# Frontend
npm start --prefix frontend

# WhatsApp Service
npm start --prefix whatsapp-service
```

### 4. Access the Application

1. Open http://localhost:3000
2. You'll be redirected to `/login`
3. Enter credentials:
   - Phone: `+919876543210`
   - PIN: `1234`
4. Access the dashboard

---

## Security Features

### PIN Hashing
- Uses bcrypt with automatic salt generation
- PIN is never stored in plaintext

### JWT Tokens
- 7-day expiry (configurable)
- Contains vendor_id and session_id
- HS256 algorithm

### Session Security
- Each login creates a new session
- Sessions can be individually revoked
- Automatic session cleanup for expired tokens
- Device fingerprinting for tracking

### Authorization
- All protected routes require valid JWT
- Token validated on each request
- Session status checked (not revoked, not expired)

---

## Future Enhancements

1. **Multi-vendor WhatsApp**: Route messages to correct vendor
2. **Role-based access**: Admin, staff, delivery roles
3. **Two-factor authentication**: OTP via SMS
4. **Audit logging**: Track all authentication events
5. **Password reset**: Self-service PIN reset

---

## Troubleshooting

### "Invalid or expired token"
- Clear localStorage and login again
- Check if SECRET_KEY changed

### "Session not found"
- Session may have been revoked from another device
- Login again to create new session

### Database indexes error
- Run `python seed_vendor.py` again
- Indexes are idempotent (safe to re-run)
