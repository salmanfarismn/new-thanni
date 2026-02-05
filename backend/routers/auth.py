"""
Authentication router for Thanni Canuuu multi-vendor system.
Handles vendor registration, login, session management, and logout.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from typing import Optional, Annotated
import os
import logging

from auth import (
    hash_pin, 
    verify_pin, 
    create_access_token, 
    decode_token,
    generate_device_fingerprint,
    generate_session_id,
    extract_token_from_header,
    ACCESS_TOKEN_EXPIRE_DAYS,
    generate_otp,
    generate_reset_token
)
from middleware.rate_limit import (
    check_rate_limit,
    record_attempt,
    clear_rate_limit,
    RateLimitError
)
from schemas import (
    VendorRegister,
    VendorLogin,
    VendorResponse,
    VendorProfileResponse,
    SessionResponse,
    SessionListResponse,
    LoginResponse,
    MessageResponse,
    PinChangeRequest,
    ProfileUpdateRequest,
    GreetingResponse
)

# Configure logging
logger = logging.getLogger(__name__)

# Router setup
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Security scheme
security = HTTPBearer(auto_error=False)

# Database connection (will be set from main app)
db = None

def set_database(database):
    """Set the database instance from main app."""
    global db
    db = database


# ============================================
# DEPENDENCY: GET CURRENT VENDOR
# ============================================

async def get_current_vendor_id(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    authorization: Annotated[Optional[str], Header()] = None
) -> str:
    """
    Dependency to get the current authenticated vendor ID.
    Validates JWT token and session, updates last_active.
    
    Returns:
        vendor_id as string
        
    Raises:
        HTTPException 401 if not authenticated
    """
    # Try to get token from security scheme or header
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization:
        token = extract_token_from_header(authorization)
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please provide a valid access token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Decode token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    vendor_id = payload.get("vendor_id")
    session_id = payload.get("session_id")
    
    if not vendor_id or not session_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Validate session exists and is not revoked
    session = await db.vendor_sessions.find_one({
        "session_id": session_id,
        "vendor_id": vendor_id,
        "is_revoked": False
    })
    
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Session not found or has been revoked",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Check if session is expired
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=401,
                detail="Session has expired. Please login again.",
                headers={"WWW-Authenticate": "Bearer"}
            )
    
    # Update last_active
    await db.vendor_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
    )
    
    return vendor_id


async def get_current_session_id(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    authorization: Annotated[Optional[str], Header()] = None
) -> str:
    """Get current session ID from token."""
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization:
        token = extract_token_from_header(authorization)
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return payload.get("session_id")


# ============================================
# REGISTRATION ENDPOINT
# ============================================

@router.post("/register", response_model=MessageResponse)
async def register_vendor(data: VendorRegister):
    """
    Register a new vendor account.
    
    - Validates phone is unique
    - Hashes PIN with bcrypt
    - Creates vendor record with personal name and business name
    """
    # Check if phone already exists
    existing = await db.vendors.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A vendor with this phone number already exists"
        )
    
    # Hash the PIN and Security Answer
    pin_hash = hash_pin(data.pin)
    security_answer_hash = hash_pin(data.security_answer.lower().strip())
    
    # Create vendor document with both name and business_name
    vendor_doc = {
        "name": data.name,
        "business_name": data.business_name,
        "phone": data.phone,
        "pin_hash": pin_hash,
        "security_question": data.security_question,
        "security_answer_hash": security_answer_hash,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.vendors.insert_one(vendor_doc)
    vendor_id = str(result.inserted_id)
    
    logger.info(f"New vendor registered: {data.name} - {data.business_name} ({data.phone})")
    
    return MessageResponse(
        success=True,
        message=f"Vendor '{data.name}' of '{data.business_name}' registered successfully. You can now login."
    )


# ============================================
# LOGIN ENDPOINT
# ============================================

@router.post("/login", response_model=LoginResponse)
async def login_vendor(data: VendorLogin, request: Request):
    """
    Login a vendor and create a new session.
    
    - Verifies credentials
    - Creates session record
    - Returns JWT access token
    """
    # Find vendor by phone
    vendor = await db.vendors.find_one({"phone": data.phone})
    
    if not vendor:
        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or PIN"
        )
    
    # Check if vendor is active
    if not vendor.get("is_active", True):
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated. Please contact support."
        )
    
    # Verify PIN
    if not verify_pin(data.pin, vendor.get("pin_hash", "")):
        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or PIN"
        )
    
    # Get client info
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "Unknown")
    device_fingerprint = generate_device_fingerprint(user_agent, client_ip)
    
    # Generate session
    session_id = generate_session_id()
    vendor_id = str(vendor["_id"])
    
    # Calculate expiry
    expires_at = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    
    # Create session document
    session_doc = {
        "session_id": session_id,
        "vendor_id": vendor_id,
        "device_name": data.device_name or "Unknown Device",
        "device_fingerprint": device_fingerprint,
        "ip_address": client_ip,
        "user_agent": user_agent,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_revoked": False
    }
    
    await db.vendor_sessions.insert_one(session_doc)
    
    # Create access token
    access_token = create_access_token(vendor_id, session_id)
    
    logger.info(f"Vendor login: {vendor['business_name']} from {client_ip}")
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # seconds
        vendor=VendorResponse(
            id=vendor_id,
            name=vendor.get("name", vendor["business_name"]),  # Fallback to business_name for existing vendors
            business_name=vendor["business_name"],
            phone=vendor["phone"],
            is_active=vendor.get("is_active", True),
            created_at=datetime.fromisoformat(vendor["created_at"]) if isinstance(vendor["created_at"], str) else vendor["created_at"]
        )
    )


# ============================================
# GET CURRENT USER (ME)
# ============================================

@router.get("/me", response_model=VendorProfileResponse)
async def get_current_user(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get current authenticated vendor's profile.
    """
    from bson import ObjectId
    
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Get statistics - filter by vendor_id for data isolation
    total_orders = await db.orders.count_documents({"vendor_id": vendor_id})
    total_customers = await db.customers.count_documents({"vendor_id": vendor_id})
    
    # Calculate total revenue
    pipeline = [
        {"$match": {"vendor_id": vendor_id, "status": "delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    return VendorProfileResponse(
        id=str(vendor["_id"]),
        name=vendor.get("name", vendor["business_name"]),  # Fallback for existing vendors
        business_name=vendor["business_name"],
        phone=vendor["phone"],
        is_active=vendor.get("is_active", True),
        created_at=datetime.fromisoformat(vendor["created_at"]) if isinstance(vendor["created_at"], str) else vendor["created_at"],
        total_orders=total_orders,
        total_customers=total_customers,
        total_revenue=total_revenue
    )


@router.get("/greeting", response_model=GreetingResponse)
async def get_greeting(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get personalized greeting based on current time in IST (Asia/Kolkata).
    
    Time periods:
    - Morning: 5:00 AM - 11:59 AM
    - Afternoon: 12:00 PM - 4:59 PM
    - Evening: 5:00 PM - 8:59 PM
    - Night: 9:00 PM - 4:59 AM
    """
    from bson import ObjectId
    
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Get current hour in IST (UTC+5:30)
    # IST offset = 5 hours 30 minutes = 5.5 hours
    utc_now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    ist_now = utc_now + ist_offset
    current_hour = ist_now.hour
    
    # Determine greeting and time period based on IST hour
    if 5 <= current_hour < 12:
        greeting = "Good morning"
        time_of_day = "morning"
    elif 12 <= current_hour < 17:
        greeting = "Good afternoon"
        time_of_day = "afternoon"
    elif 17 <= current_hour < 21:
        greeting = "Good evening"
        time_of_day = "evening"
    else:
        greeting = "Good night"
        time_of_day = "night"
    
    vendor_name = vendor.get("name", vendor["business_name"])  # Fallback for existing vendors
    
    return GreetingResponse(
        greeting=greeting,
        vendor_name=vendor_name,
        business_name=vendor["business_name"],
        time_of_day=time_of_day
    )


# ============================================
# SESSION MANAGEMENT
# ============================================

@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(
    vendor_id: str = Depends(get_current_vendor_id),
    current_session: str = Depends(get_current_session_id)
):
    """
    Get all active sessions for the current vendor.
    """
    sessions = await db.vendor_sessions.find({
        "vendor_id": vendor_id,
        "is_revoked": False
    }).sort("last_active", -1).to_list(100)
    
    session_list = []
    for s in sessions:
        session_list.append(SessionResponse(
            session_id=s["session_id"],
            device_name=s.get("device_name", "Unknown"),
            ip_address=s.get("ip_address", "unknown"),
            created_at=datetime.fromisoformat(s["created_at"]) if isinstance(s["created_at"], str) else s["created_at"],
            last_active=datetime.fromisoformat(s["last_active"]) if isinstance(s["last_active"], str) else s["last_active"],
            is_current=(s["session_id"] == current_session)
        ))
    
    return SessionListResponse(
        sessions=session_list,
        total=len(session_list)
    )


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: str,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Revoke a specific session (logout from device).
    """
    # Find and verify session belongs to vendor
    session = await db.vendor_sessions.find_one({
        "session_id": session_id,
        "vendor_id": vendor_id
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get("is_revoked"):
        return MessageResponse(success=True, message="Session already revoked")
    
    # Revoke the session
    await db.vendor_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"is_revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"Session revoked: {session_id} for vendor {vendor_id}")
    
    return MessageResponse(success=True, message="Session revoked successfully")


@router.post("/logout", response_model=MessageResponse)
async def logout(
    vendor_id: str = Depends(get_current_vendor_id),
    current_session: str = Depends(get_current_session_id)
):
    """
    Logout from the current session.
    """
    await db.vendor_sessions.update_one(
        {"session_id": current_session},
        {"$set": {"is_revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"Vendor logout: session {current_session}")
    
    return MessageResponse(success=True, message="Logged out successfully")


# ============================================
# PIN MANAGEMENT
# ============================================

@router.post("/change-pin", response_model=MessageResponse)
async def change_pin(
    data: PinChangeRequest,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Change the vendor's PIN.
    """
    from bson import ObjectId
    
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Verify current PIN
    if not verify_pin(data.current_pin, vendor.get("pin_hash", "")):
        raise HTTPException(status_code=401, detail="Current PIN is incorrect")
    
    # Hash new PIN
    new_pin_hash = hash_pin(data.new_pin)
    
    # Update PIN
    await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {"pin_hash": new_pin_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"PIN changed for vendor {vendor_id}")
    
    return MessageResponse(success=True, message="PIN changed successfully")


# ============================================
# PROFILE UPDATE
# ============================================

@router.patch("/profile", response_model=VendorResponse)
async def update_profile(
    data: ProfileUpdateRequest,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Update vendor profile (name and/or business_name).
    """
    from bson import ObjectId
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.business_name:
        update_data["business_name"] = data.business_name
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": update_data}
    )
    
    # Get updated vendor
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
    
    return VendorResponse(
        id=str(vendor["_id"]),
        name=vendor.get("name", vendor["business_name"]),  # Fallback for existing vendors
        business_name=vendor["business_name"],
        phone=vendor["phone"],
        is_active=vendor.get("is_active", True),
        created_at=datetime.fromisoformat(vendor["created_at"]) if isinstance(vendor["created_at"], str) else vendor["created_at"]
    )


# ============================================
# FORGOT PIN / PASSWORD RECOVERY (SECURITY QUESTION)
# ============================================

from pydantic import BaseModel

class ForgotPinRequest(BaseModel):
    phone: str

class VerifyAnswerRequest(BaseModel):
    phone: str
    answer: str

class ResetPinRequest(BaseModel):
    phone: str
    reset_token: str
    new_pin: str


@router.post("/forgot-pin/request", response_model=MessageResponse)
async def get_security_question(data: ForgotPinRequest):
    """
    Step 1: Request security question for the phone number.
    Returns the question if user exists.
    """
    phone = data.phone.strip()
    if not phone.startswith('+'):
        phone = f"+91{phone.replace('+91', '').replace(' ', '')}"
    
    # Rate limit check
    rate_key = f"forgot_pin:{phone}"
    try:
        check_rate_limit(rate_key, max_attempts=10, window_seconds=3600)
    except RateLimitError as e:
        logger.warning(f"Rate limit exceeded for forgot PIN: {phone}")
        raise HTTPException(status_code=429, detail=str(e))
    
    # Find vendor by phone
    vendor = await db.vendors.find_one({"phone": phone})
    
    if not vendor:
        record_attempt(rate_key)
        # For security, we might not want to reveal this, but for usability in this specific app context, 
        # generic message is better. However, to show the question we MUST reveal existence.
        # Since we are moving to questions, we have to return the question.
        raise HTTPException(status_code=404, detail="Phone number not registered.")
    
    if not vendor.get("security_question"):
        raise HTTPException(status_code=400, detail="Security question not set for this account. Contact admin.")

    return MessageResponse(
        success=True,
        message="Security question retrieved.",
        data={"security_question": vendor["security_question"]}
    )


@router.post("/forgot-pin/verify", response_model=MessageResponse)
async def verify_security_answer(data: VerifyAnswerRequest):
    """
    Step 2: Verify the security answer.
    Returns a reset token for the next step.
    """
    phone = data.phone.strip()
    if not phone.startswith('+'):
        phone = f"+91{phone.replace('+91', '').replace(' ', '')}"
    
    vendor = await db.vendors.find_one({"phone": phone})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # Rate limit check for verification
    rate_key = f"verify_answer:{phone}"
    try:
        check_rate_limit(rate_key, max_attempts=3, window_seconds=600) # 3 attempts in 10 mins
    except RateLimitError:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Try again later.")

    # Verify answer
    if not verify_pin(data.answer.lower().strip(), vendor.get("security_answer_hash", "")):
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Incorrect answer.")

    # Generate reset token
    reset_token = generate_reset_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # Store token in a separate collection or overwrite existing OTP collection structure
    # We will reuse 'pin_reset_otps' but with different fields
    await db.pin_reset_otps.update_one(
        {"phone": phone},
        {
            "$set": {
                "phone": phone,
                "vendor_id": str(vendor["_id"]),
                "reset_token": reset_token,
                "expires_at": expires_at.isoformat(),
                "verified": True, # Automatically verified since we passed answer check
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    clear_rate_limit(rate_key)
    
    return MessageResponse(
        success=True,
        message="Answer verified successfully.",
        data={"reset_token": reset_token}
    )


@router.post("/forgot-pin/reset", response_model=MessageResponse)
async def reset_pin(data: ResetPinRequest):
    """
    Step 3: Reset PIN using verified reset token.
    """
    from bson import ObjectId
    
    phone = data.phone.strip()
    if not phone.startswith('+'):
        phone = f"+91{phone.replace('+91', '').replace(' ', '')}"
    
    # Validate PIN format
    if not data.new_pin.isdigit() or len(data.new_pin) < 4 or len(data.new_pin) > 6:
        raise HTTPException(status_code=400, detail="PIN must be 4-6 digits")
    
    # Check token validity
    token_record = await db.pin_reset_otps.find_one({
        "phone": phone,
        "reset_token": data.reset_token,
        "verified": True
    })
    
    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset session. Start over.")
        
    expires_at = datetime.fromisoformat(token_record["expires_at"].replace('Z', '+00:00'))
    if expires_at < datetime.now(timezone.utc):
        await db.pin_reset_otps.delete_one({"phone": phone})
        raise HTTPException(status_code=400, detail="Session expired. Start over.")

    vendor = await db.vendors.find_one({"phone": phone})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_id = str(vendor["_id"])
    new_pin_hash = hash_pin(data.new_pin)
    
    await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {
            "$set": {
                "pin_hash": new_pin_hash,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "pin_reset_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Invalidate sessions
    await db.vendor_sessions.update_many(
        {"vendor_id": vendor_id, "is_revoked": False},
        {"$set": {"is_revoked": True, "revoke_reason": "pin_reset"}}
    )
    
    await db.pin_reset_otps.delete_one({"phone": phone})
    
    return MessageResponse(
        success=True,
        message="PIN reset successful! Login with your new PIN."
    )

