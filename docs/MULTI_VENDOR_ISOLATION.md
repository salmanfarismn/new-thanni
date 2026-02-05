# Multi-Vendor Data Isolation & Personalization

## Overview

This document describes the multi-vendor data isolation and personalization system implemented in Thanni Canuuu. This ensures that each vendor sees only their own data and receives personalized greetings.

## Key Features

### 1. Vendor Personalization
- **Personal Name Field**: Vendors now have a separate `name` field (e.g., "Rajesh") distinct from `business_name` (e.g., "Kumar Water Supply")
- **Personalized Greetings**: Dashboard shows "Good Morning, Rajesh" instead of generic "Good Morning, Admin"
- **Time-based Greetings**: Uses IST (India Standard Time) for accurate greetings:
  - Morning: 5:00 AM - 11:59 AM
  - Afternoon: 12:00 PM - 4:59 PM
  - Evening: 5:00 PM - 8:59 PM
  - Night: 9:00 PM - 4:59 AM

### 2. Data Isolation

**CRITICAL SECURITY RULE**: `vendor_id` is NEVER accepted from request body/params. It must ALWAYS come from JWT token.

#### Protected Endpoints (require vendor_id from JWT):

| Endpoint | Method | Data Isolated |
|----------|--------|---------------|
| `/api/orders` | GET | ✅ Only vendor's orders |
| `/api/orders/tomorrow` | GET | ✅ Only vendor's orders |
| `/api/orders/delivery-queue` | GET | ✅ Only vendor's orders |
| `/api/dashboard/metrics` | GET | ✅ Metrics for vendor's data only |
| `/api/dashboard/sales` | GET | ✅ Sales for vendor's orders only |
| `/api/customers` | GET/POST | ✅ Vendor's customers only |
| `/api/customers/{phone}` | GET | ✅ Vendor's customers only |
| `/api/delivery-staff` | GET/POST/PUT/DELETE | ✅ Vendor's staff only |
| `/api/auth/me` | GET | ✅ Current vendor profile |
| `/api/auth/greeting` | GET | ✅ Personalized greeting |

## Backend Changes

### 1. Schema Updates (`schemas.py`)

```python
class VendorRegister(BaseModel):
    name: str  # NEW: Vendor's personal name
    business_name: str
    phone: str
    pin: str

class VendorResponse(BaseModel):
    id: str
    name: str  # NEW: Vendor's personal name
    business_name: str
    # ...

class GreetingResponse(BaseModel):  # NEW
    greeting: str      # "Good morning", "Good afternoon", etc.
    vendor_name: str   # Vendor's personal name
    business_name: str
    time_of_day: str   # "morning", "afternoon", "evening", "night"
```

### 2. Auth Router Updates (`routers/auth.py`)

- **Registration**: Stores vendor's personal `name` along with `business_name`
- **Login**: Returns `name` in vendor response
- **GET /auth/greeting**: New endpoint for personalized, IST-based greeting
- **GET /auth/me**: Returns `name` in profile response
- **PATCH /auth/profile**: Supports updating `name`

### 3. Server Updates (`server.py`)

Added `get_current_vendor_id` dependency that:
- Extracts vendor_id from JWT token
- Validates session is active and not expired
- Updates last_active timestamp

All data endpoints now use this dependency to filter queries by `vendor_id`.

## Frontend Changes

### 1. Registration Page (`Register.js`)
- Added "Your Name" input field
- Sends `name` along with `business_name` during registration

### 2. Login Page (`Login.js`)
- Displays personalized welcome message with vendor's name

### 3. Dashboard (`Dashboard.js`)
- Fetches greeting from `/auth/greeting` API
- Displays personalized greeting with vendor's name
- Falls back to localStorage data if API fails

## Database Schema

### Vendor Document
```json
{
    "_id": "ObjectId",
    "name": "Rajesh",           // Personal name
    "business_name": "Kumar Water Supply",  // Business name
    "phone": "+919876543210",
    "pin_hash": "bcrypt_hash",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
}
```

### Order Document (with vendor_id)
```json
{
    "order_id": "ORD20240101120000",
    "vendor_id": "vendor_object_id",  // CRITICAL: Added for isolation
    "customer_phone": "919876543211",
    // ... other fields
}
```

### Customer Document (with vendor_id)
```json
{
    "phone_number": "919876543211",
    "name": "Customer Name",
    "address": "Customer Address",
    "vendor_id": "vendor_object_id",  // CRITICAL: Added for isolation
    "created_at": "2024-01-01T00:00:00Z"
}
```

### Delivery Staff Document (with vendor_id)
```json
{
    "staff_id": "STAFF001",
    "name": "Delivery Person",
    "phone_number": "919876543212",
    "vendor_id": "vendor_object_id",  // CRITICAL: Added for isolation
    // ... other fields
}
```

## Security Considerations

1. **Never Trust Client Input for vendor_id**: Always extract from JWT
2. **All Data Queries MUST Filter by vendor_id**: This is enforced at the API level
3. **Session Validation**: Every request validates session is active and not expired
4. **Backward Compatibility**: Existing vendors without `name` field fall back to `business_name`

## Future Enhancements

1. **Per-Vendor Stock**: Currently stock is global; should be per-vendor
2. **WhatsApp Multi-Vendor**: WhatsApp bot needs to identify vendor for incoming messages
3. **Per-Vendor Pricing**: Allow each vendor to set their own prices
4. **Vendor Onboarding**: Admin panel to manage multiple vendors

## Testing

To test multi-vendor isolation:

1. Register two vendors with different names
2. Login as Vendor A, create customers/orders
3. Login as Vendor B, verify you cannot see Vendor A's data
4. Verify dashboard metrics only show current vendor's data
5. Verify greeting shows the correct vendor name and time-based message
