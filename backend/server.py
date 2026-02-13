from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Depends, Header, UploadFile, File
import shutil
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date, timedelta
import httpx
from whatsapp_cloud_api import whatsapp_api
from contextlib import asynccontextmanager
import asyncio
from collections import deque
from bson import ObjectId

import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Validate required environment variables
required_env_vars = ['MONGO_URL', 'DB_NAME']
missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
if missing_vars:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}. Please check your .env file.")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Import auth utilities for vendor authentication
from auth import decode_token, extract_token_from_header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated

# Security scheme for protected endpoints
security = HTTPBearer(auto_error=False)

async def get_current_vendor_id(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)] = None,
    authorization: Annotated[Optional[str], Header()] = None
) -> str:
    """
    Dependency to get the current authenticated vendor ID from JWT token.
    CRITICAL: This is the ONLY source of truth for vendor_id.
    NEVER accept vendor_id from request body/params - it must come from JWT.
    
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up HydroFlow backend...")
    logger.info(f"Connected to MongoDB: {os.environ['DB_NAME']}")

    # Create database indexes for performance
    try:
        await db.orders.create_index([("vendor_id", 1), ("order_id", 1)], unique=True)
        await db.orders.create_index([("vendor_id", 1), ("status", 1)])
        await db.orders.create_index([("delivery_staff_id", 1), ("status", 1)])
        await db.orders.create_index([("created_at", -1)])
        await db.customers.create_index([("vendor_id", 1), ("phone_number", 1)], unique=True)
        await db.stock.create_index([("vendor_id", 1), ("date", 1)], unique=True)
        await db.customer_states.create_index([("updated_at", 1)], expireAfterSeconds=3600)
        await db.vendor_sessions.create_index([("vendor_id", 1), ("session_id", 1)])
        logger.info("Database indexes created/verified successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")

    yield
    # Shutdown
    logger.info("Shutting down HydroFlow backend...")
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# Mount static files for uploaded photos
import os as _os
_static_dir = Path(__file__).parent / "static"
_static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

@api_router.get("/health")
async def health_check():
    """Comprehensive health check endpoint for monitoring"""
    services = {}
    overall_healthy = True

    # Check MongoDB
    try:
        await db.command("ping")
        services["database"] = "ok"
    except Exception as e:
        services["database"] = f"error: {str(e)}"
        overall_healthy = False

    # Check WhatsApp service
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"{WHATSAPP_SERVICE_URL}/health",
                timeout=5.0
            )
            if response.status_code == 200:
                services["whatsapp"] = "ok"
            else:
                services["whatsapp"] = "degraded"
    except Exception:
        services["whatsapp"] = "unreachable"

    from fastapi.responses import JSONResponse
    status_code = 200 if overall_healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if overall_healthy else "unhealthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": services
        }
    )

WHATSAPP_SERVICE_URL = os.environ.get('WHATSAPP_SERVICE_URL', 'http://localhost:3001')
SERVICE_API_KEY = os.environ.get('SERVICE_API_KEY')
if not SERVICE_API_KEY:
    raise RuntimeError("CRITICAL: SERVICE_API_KEY environment variable is required. Set it in your .env file.")

# Mount static files
from fastapi.staticfiles import StaticFiles
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

async def verify_service_api_key(x_api_key: str = Header(None)):
    """
    Verify API Key for internal service communication (e.g. WhatsApp Service).
    """
    if x_api_key != SERVICE_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid Service API Key",
        )
    return x_api_key

# ============================================
# SECURITY MIDDLEWARES
# ============================================

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class SecureHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        return response

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.request_counts = {}
        self.window_size = 60  # seconds
        self.limit = 1000      # requests per window

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        current_time = datetime.now().timestamp()
        
        # Clean up old requests
        self.request_counts = {
            ip: (count, timestamp) 
            for ip, (count, timestamp) in self.request_counts.items() 
            if current_time - timestamp < self.window_size
        }
        
        if client_ip in self.request_counts:
            count, timestamp = self.request_counts[client_ip]
            if count >= self.limit:
                return Response("Rate limit exceeded", status_code=429)
            self.request_counts[client_ip] = (count + 1, timestamp)
        else:
            self.request_counts[client_ip] = (1, current_time)
            
        return await call_next(request)

app.add_middleware(SecureHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

class PriceSetting(BaseModel):
    litre_size: int
    price_per_can: float
    is_active: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryShift(BaseModel):
    date: str
    staff_id: str
    staff_name: str
    shift: str
    is_active: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Customer(BaseModel):
    phone_number: str
    name: str
    address: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryStaff(BaseModel):
    staff_id: str
    name: str
    phone_number: str
    pin: Optional[str] = Field(default=None, exclude=True, description="Agent login PIN (4-6 digits), will be hashed")
    active_orders_count: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============================================
# PAYMENT STATUS CONSTANTS
# ============================================
class PaymentStatus:
    """Payment status constants for consistent tracking"""
    PENDING = "pending"              # Not yet processed
    PAID_CASH = "paid_cash"          # Paid via cash
    PAID_UPI = "paid_upi"            # Paid via UPI
    UPI_PENDING = "upi_pending"      # Customer selected UPI, awaiting payment
    CASH_DUE = "cash_due"            # Customer will pay later in cash
    DELIVERED_UNPAID = "delivered_unpaid"  # Delivered but not paid

# ============================================
# CUSTOMER STATE CONSTANTS
# ============================================
class CustomerState:
    """Customer conversation state constants"""
    IDLE = "idle"                              # No active conversation
    ORDERING = "ordering"                      # In the middle of placing order
    AWAITING_CONFIRMATION = "awaiting_confirmation"  # Order pending confirmation
    ORDER_ACTIVE = "order_active"              # Has an active/pending order
    CHECKING_STATUS = "checking_status"        # Checking order status
    PAYMENT_PENDING = "payment_pending"        # Awaiting payment confirmation

# ============================================
# ORDER STATUS CONSTANTS
# ============================================
class OrderStatus:
    """Order delivery status constants"""
    IN_QUEUE = "in_queue"              # Order in queue
    ASSIGNED = "assigned"              # Assigned to delivery staff
    OUT_FOR_DELIVERY = "out_for_delivery"  # On the way
    DELIVERED = "delivered"            # Delivered
    DELAYED = "delayed"                # Delayed
    PENDING = "pending"                # Legacy pending status
    CANCELLED = "cancelled"            # Cancelled

class Order(BaseModel):
    order_id: str
    customer_phone: str
    customer_name: str
    customer_address: str
    litre_size: int
    quantity: int
    price_per_can: float
    status: str
    delivery_staff_id: Optional[str] = None
    delivery_staff_name: Optional[str] = None
    payment_status: str = PaymentStatus.PENDING
    payment_method: Optional[str] = None
    amount: float
    amount_due: Optional[float] = None  # Tracks outstanding due
    shift_assigned: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    delivered_at: Optional[datetime] = None
    payment_confirmed_at: Optional[datetime] = None  # When payment was confirmed
    # Notification queue fields
    notification_status: str = "queued"  # queued, sending, sent, failed
    notification_attempts: int = 0
    last_notification_error: Optional[str] = None
    # Delivery queue fields
    delivery_queue_position: Optional[int] = None
    delivery_queue_acknowledged: bool = False
    empty_cans_collected: Optional[int] = 0  # Number of empty cans collected during delivery

class Stock(BaseModel):
    date: str
    total_stock: int
    available_stock: int
    orders_count: int
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IncomingMessage(BaseModel):
    phone_number: str
    message: str
    message_id: str
    timestamp: int

class MessageResponse(BaseModel):
    reply: Optional[str] = None
    success: bool = True

class OrderCreateRequest(BaseModel):
    customer_phone: str
    customer_name: str
    customer_address: str
    litre_size: int
    quantity: int
    vendor_id: Optional[str] = None  # Added for multi-vendor support

# New: Multi-item order for WhatsApp bot
class OrderItemRequest(BaseModel):
    litre_size: int
    quantity: int
    price_per_can: float

class MultiItemOrderRequest(BaseModel):
    customer_phone: str
    customer_name: str
    customer_address: str
    items: list[OrderItemRequest]
    delivery_date: Optional[str] = None
    is_tomorrow_order: bool = False
    vendor_id: Optional[str] = None  # For WhatsApp service to specify vendor

# New: Customer creation request
class CustomerCreateRequest(BaseModel):
    phone_number: str
    name: str
    address: str

class CustomerUpdateRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None

# New: Inventory check request
class InventoryCheckRequest(BaseModel):
    quantity: int


class StockUpdateRequest(BaseModel):
    total_stock: Optional[int] = None
    increment: Optional[int] = None

class DeliveryUpdate(BaseModel):
    order_id: str
    status: str
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    amount_due: Optional[float] = None
    payment_confirmed_at: Optional[str] = None
    empty_cans_collected: Optional[int] = None

# ============================================
# CUSTOMER STATE MODELS
# ============================================
class CustomerStateModel(BaseModel):
    """Model for tracking customer conversation state in database"""
    vendor_id: str
    phone_number: str
    state: str = CustomerState.IDLE
    last_order_id: Optional[str] = None
    order_data: Optional[dict] = None  # Temporary order data during ordering flow
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerStateUpdate(BaseModel):
    """Model for updating customer state"""
    state: str
    order_data: Optional[dict] = None
    last_order_id: Optional[str] = None

# ============================================
# OUTSTANDING/DUE MANAGEMENT MODELS
# ============================================
class OutstandingSummary(BaseModel):
    """Summary of outstanding dues"""
    total_due: float
    upi_pending_amount: float
    cash_due_amount: float
    delivered_unpaid_amount: float
    total_orders: int
    upi_pending_orders: int
    cash_due_orders: int
    delivered_unpaid_orders: int

# ============================================
# ORDER NOTIFICATION QUEUE SYSTEM
# ============================================
notification_queue = deque()
queue_lock = asyncio.Lock()
queue_processor_task = None

async def add_to_notification_queue(order_id: str):
    """Add an order to the notification queue and start processor if needed"""
    global queue_processor_task
    
    async with queue_lock:
        # Avoid duplicates
        if order_id not in notification_queue:
            notification_queue.append(order_id)
            logger.info(f"Added order {order_id} to notification queue. Queue size: {len(notification_queue)}")
    
    # Start processor if not running
    if queue_processor_task is None or queue_processor_task.done():
        queue_processor_task = asyncio.create_task(process_notification_queue())

async def process_notification_queue():
    """Background worker to process order notifications sequentially"""
    logger.info("Starting notification queue processor...")
    
    while True:
        order_id = None
        async with queue_lock:
            if notification_queue:
                order_id = notification_queue.popleft()
        
        if order_id is None:
            logger.info("Notification queue empty, processor stopping.")
            break
        
        try:
            await send_order_notification(order_id)
        except Exception as e:
            logger.error(f"Error processing notification for {order_id}: {e}")
        
        # Rate limiting - wait between messages
        await asyncio.sleep(0.5)

async def get_company_name_for_vendor(vendor_id: Optional[str] = None) -> str:
    """Get vendor's business name for notifications and branding"""
    if not vendor_id:
        return "Thanni Canuuu"
    try:
        from bson import ObjectId
        vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
        if vendor and vendor.get("business_name"):
            return vendor["business_name"]
    except Exception as e:
        logger.warning(f"Error fetching vendor company name: {e}")
    return "Thanni Canuuu"

async def send_order_notification(order_id: str):
    """Send WhatsApp notification for a specific order"""
    # DISABLED: Delivery staff now use the dashboard app.
    # We mark it as sent to keep the state consistent but don't send actual msg.
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"notification_status": "sent", "last_notification_error": None}}
    )
    return

    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        logger.warning(f"Order {order_id} not found for notification")
        return
    
    # Skip if already sent
    if order.get('notification_status') == 'sent':
        logger.info(f"Order {order_id} notification already sent, skipping")
        return
    
    # Mark as sending
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"notification_status": "sending"}}
    )
    
    try:
        # Get delivery staff (filtered by vendor for security)
        vendor_id = order.get('vendor_id')
        staff_query = {"staff_id": order.get('delivery_staff_id')}
        if vendor_id:
            staff_query["vendor_id"] = vendor_id
        staff = await db.delivery_staff.find_one(staff_query)
        if not staff:
            raise Exception("Delivery staff not found")
        
        # Skip if delivery staff is inactive
        if not staff.get('is_active', True):
            logger.warning(f"Delivery staff {staff['staff_id']} is inactive, skipping notification")
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {
                    "notification_status": "failed",
                    "last_notification_error": "Delivery staff is inactive"
                }}
            )
            return
        
        # Get company name for branding (per-vendor)
        company_name = await get_company_name_for_vendor(vendor_id)

        
        # Build notification message
        message = (
            f"🚚 New Delivery Assignment from {company_name}\n\n"
            f"*Order ID:* {order['order_id']}\n"
            f"*Shift:* {(order.get('shift_assigned') or 'N/A').upper()}\n"
            f"*Customer:* {order['customer_name']}\n"
            f"*Phone:* {order['customer_phone']}\n"
            f"*Address:* {order['customer_address']}\n"
            f"*Can Size:* {order['litre_size']}L\n"
            f"*Quantity:* {order['quantity']} cans\n"
            f"*Amount:* ₹{order['amount']}\n\n"
            f"Please deliver ASAP!\n\n"
            f"*After delivery, reply with:*\n"
            f"*1* - Delivered (payment pending)\n"
            f"*2* - Delivered & Paid (Cash)\n"
            f"*3* - Delivered & Paid (UPI)"
        )
        
        # Send message to delivery boy using correct vendor session
        result = await send_whatsapp_message(staff['phone_number'], message, vendor_id=order.get('vendor_id'))
        
        if result.get('success'):
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {
                    "notification_status": "sent",
                    "last_notification_error": None
                }}
            )
            logger.info(f"Notification sent successfully for order {order_id}")
        else:
            raise Exception(result.get('error', 'Unknown error'))
            
    except Exception as e:
        error_msg = str(e)
        attempts = order.get('notification_attempts', 0) + 1
        
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "notification_status": "failed",
                "notification_attempts": attempts,
                "last_notification_error": error_msg
            }}
        )
        logger.error(f"Failed to send notification for order {order_id}: {error_msg}")

def normalize_phone_number(phone_number: str) -> str:
    """Normalize phone number to include country code (91 for India)"""
    # Remove any non-digit characters
    digits_only = ''.join(filter(str.isdigit, phone_number))
    
    # If number starts with 0, remove it
    if digits_only.startswith('0'):
        digits_only = digits_only[1:]
    
    # If it's a 10-digit Indian number, add country code
    if len(digits_only) == 10:
        digits_only = '91' + digits_only
    
    # If it starts with +91, it's already normalized (just remove the +)
    # The digits_only already handles this case
    
    return digits_only

async def send_whatsapp_message(phone_number: str, message: str, vendor_id: Optional[str] = None):
    """
    Send WhatsApp message using available method.
    If vendor_id is provided, sends via that vendor's session.
    """
    try:
        # Normalize phone number to include country code
        normalized_phone = normalize_phone_number(phone_number)
        logger.info(f"Sending WhatsApp message to {normalized_phone} (Vendor: {vendor_id})")
        
        # Try Cloud API first if configured
        if whatsapp_api.phone_number_id and whatsapp_api.access_token:
            result = await whatsapp_api.send_text_message(normalized_phone, message)
            if result.get('success'):
                return result
        
        # Fallback to Baileys service (Multi-Vendor)
        async with httpx.AsyncClient() as client:
            url = f"{WHATSAPP_SERVICE_URL}/send/{vendor_id}" if vendor_id else f"{WHATSAPP_SERVICE_URL}/send"
            response = await client.post(
                url,
                json={"to": normalized_phone, "message": message},
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        logging.error(f"Failed to send WhatsApp message: {e}")
        return {"success": False, "error": str(e)}

async def send_whatsapp_buttons(phone_number: str, body_text: str, buttons: list, header: str = None):
    """Send WhatsApp buttons using available method"""
    try:
        # Normalize phone number to include country code
        normalized_phone = normalize_phone_number(phone_number)
        
        # Try Cloud API first if configured
        if whatsapp_api.phone_number_id and whatsapp_api.access_token:
            result = await whatsapp_api.send_interactive_buttons(normalized_phone, body_text, buttons, header=header)
            if result.get('success'):
                return result
        
        # Fallback to Baileys with text format
        button_text = body_text + "\n\n"
        for i, btn in enumerate(buttons, 1):
            button_text += f"{i}. {btn['title']}\n"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send",
                json={"phone_number": normalized_phone, "message": button_text},
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        logging.error(f"Failed to send WhatsApp buttons: {e}")
        return {"success": False, "error": str(e)}

async def get_or_create_customer(phone_number: str, name: str = None, address: str = None):
    customer = await db.customers.find_one({"phone_number": phone_number})
    if not customer:
        customer_data = {
            "phone_number": phone_number,
            "name": name or "Customer",
            "address": address or "Not provided",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.customers.insert_one(customer_data)
        return customer_data
    return customer

async def get_next_delivery_staff():
    staff = await db.delivery_staff.find().sort("active_orders_count", 1).limit(1).to_list(1)
    if staff:
        return staff[0]
    return None

async def get_active_delivery_staff_for_shift(vendor_id: Optional[str] = None):
    """Get delivery staff active for current time shift, filtered by vendor_id if provided"""
    current_hour = datetime.now(timezone.utc).hour
    
    if 6 <= current_hour < 14:
        shift = "morning"
    else:
        shift = "evening"
    
    today = date.today().isoformat()
    
    shift_query = {
        "date": today,
        "is_active": True,
        "$or": [
            {"shift": shift},
            {"shift": "full_day"}
        ]
    }
    if vendor_id:
        shift_query["vendor_id"] = vendor_id
    
    active_shifts = await db.delivery_shifts.find(shift_query).to_list(100)
    
    if not active_shifts:
        # Fallback: If no shifts scheduled, try to find ANY active staff
        # This prevents order failures if shifts aren't strictly managed
        fallback_query = {"is_active": True}
        if vendor_id:
            fallback_query["vendor_id"] = vendor_id
            
        any_staff = await db.delivery_staff.find(fallback_query).sort("active_orders_count", 1).limit(1).to_list(1)
        if any_staff:
             return any_staff[0], "flexible"
             
        return None, None
    
    staff_ids = [s['staff_id'] for s in active_shifts]
    
    staff = await db.delivery_staff.find({
        "staff_id": {"$in": staff_ids},
        "is_active": True,
        **({"vendor_id": vendor_id} if vendor_id else {})
    }).sort("active_orders_count", 1).limit(1).to_list(1)
    
    if staff:
        return staff[0], shift
        
    # Double fallback if shifts exist but staff inactive?
    # Reuse fallback logic
    fallback_query = {"is_active": True}
    if vendor_id:
        fallback_query["vendor_id"] = vendor_id
        
    any_staff = await db.delivery_staff.find(fallback_query).sort("active_orders_count", 1).limit(1).to_list(1)
    if any_staff:
         return any_staff[0], "flexible"
            
    return None, None

async def get_price_for_litre(litre_size: int, vendor_id: Optional[str] = None):
    """Get current price for a litre size, filtered by vendor if provided"""
    query = {"litre_size": litre_size, "is_active": True}
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    price_setting = await db.price_settings.find_one(query)
    
    if price_setting:
        return price_setting['price_per_can']
    
    # Fallback to global defaults
    if litre_size == 20:
        return 50.0
    elif litre_size == 25:
        return 65.0
    return 50.0

async def get_today_stock(vendor_id: Optional[str] = None):
    """Get stock for today, filtered by vendor_id"""
    today = date.today().isoformat()
    query = {"date": today}
    if vendor_id:
        query["vendor_id"] = vendor_id
        
    stock = await db.stock.find_one(query, {"_id": 0})
    if not stock:
        stock = {
            "date": today,
            "total_stock": 50,
            "available_stock": 50,
            "orders_count": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        if vendor_id:
            stock["vendor_id"] = vendor_id
            
        await db.stock.insert_one(stock)
        stock.pop("_id", None)
    return stock

@api_router.get("/whatsapp/webhook", response_class=PlainTextResponse)
async def verify_whatsapp_webhook(request: Request):
    """Verify WhatsApp webhook during setup"""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    verify_token = os.environ.get('WHATSAPP_VERIFY_TOKEN', 'default_verify_token')
    
    result = whatsapp_api.verify_webhook(mode, token, challenge, verify_token)
    
    if result:
        return PlainTextResponse(result)
    raise HTTPException(status_code=403, detail="Forbidden")

@api_router.post("/whatsapp/webhook")
async def receive_whatsapp_webhook(request: Request):
    """Handle incoming WhatsApp messages via webhook"""
    try:
        body = await request.json()
        logging.info(f"Received webhook: {body}")
        
        # Extract message data
        message_data = whatsapp_api.extract_message_data(body)
        
        if not message_data:
            return {"status": "ok"}
        
        # Mark message as read
        await whatsapp_api.mark_message_as_read(message_data["message_id"])
        
        # Process the message
        await handle_whatsapp_message_webhook(message_data)
        
        return {"status": "ok", "processed": True}
    
    except Exception as e:
        logging.error(f"Error processing webhook: {e}")
        return {"status": "error", "message": str(e)}

async def handle_whatsapp_message_webhook(message_data: dict):
    """Process incoming WhatsApp message and send response"""
    try:
        phone_number = message_data["from"]
        message_text = message_data["text"].strip().lower()
        button_id = message_data.get("button_id")
        
        # If it's a button response, use button_id as message
        if button_id:
            message_text = button_id.lower()
        
        logging.info(f"Processing message from {phone_number}: {message_text}")
        
        response = await process_customer_message(phone_number, message_text)
        
        return response
    
    except Exception as e:
        logging.error(f"Error in webhook message handler: {e}")
        return None

async def process_customer_message(phone_number: str, message_text: str):
    """Process customer or delivery boy message"""
    # Check if it's a delivery boy
    delivery_person = await db.delivery_staff.find_one({"phone_number": phone_number})
    
    if delivery_person:
        return await handle_delivery_boy_message(phone_number, message_text, delivery_person)
    else:
        return await handle_customer_message(phone_number, message_text)

async def handle_customer_message(phone_number: str, message_text: str):
    """Handle customer order flow"""
    try:
        if any(word in message_text for word in ['hi', 'hello', 'water', 'order']):
            customer = await get_or_create_customer(phone_number)
            if customer.get('name') == 'Customer' or customer.get('address') == 'Not provided':
                await send_whatsapp_message(
                    phone_number,
                    "Welcome to HydroFlow! 💧\n\nTo place an order, please share:\n1. Your Name\n2. Your Address\n\nExample: My name is John, address is 123 Main St"
                )
            else:
                stock = await get_today_stock()
                if stock['available_stock'] > 0:
                    await db.customer_sessions.update_one(
                        {"phone_number": phone_number},
                        {"$set": {"step": "awaiting_litre", "updated_at": datetime.now(timezone.utc).isoformat()}},
                        upsert=True
                    )
                    await send_whatsapp_message(
                        phone_number,
                        f"Hello {customer['name']}! 💧\n\nWhich size water can do you need?\n\nReply with:\n*20* - 20 Litre can\n*25* - 25 Litre can\n\nAvailable stock: {stock['available_stock']} cans"
                    )
                else:
                    await send_whatsapp_message(
                        phone_number,
                        "Sorry! We're out of stock for today. 😔\n\nPlease try again tomorrow!"
                    )

        elif message_text.startswith('name:') or message_text.startswith('my name'):
            parts = message_text.replace('name:', '').replace('my name is', '').replace(',', ' ').split()
            name = ' '.join(parts[:3])
            await db.customers.update_one(
                {"phone_number": phone_number},
                {"$set": {"name": name.strip()}},
                upsert=True
            )
            await send_whatsapp_message(
                phone_number,
                f"Thanks {name}! Now please share your delivery address."
            )

        elif message_text.startswith('address:') or 'address' in message_text.lower():
            address = message_text.replace('address:', '').strip()
            await db.customers.update_one(
                {"phone_number": phone_number},
                {"$set": {"address": address}}
            )
            await send_whatsapp_message(
                phone_number,
                "Perfect! Now you can order water cans. Send 'order' to start."
            )

        elif message_text in ['20', '25']:
            session = await db.customer_sessions.find_one({"phone_number": phone_number})
            
            if not session or session.get('step') != 'awaiting_litre':
                await send_whatsapp_message(
                    phone_number,
                    "Please start your order by sending 'hi' or 'order'."
                )
                return
            
            litre_size = int(message_text)
            price = await get_price_for_litre(litre_size)
            
            await db.customer_sessions.update_one(
                {"phone_number": phone_number},
                {"$set": {
                    "step": "awaiting_quantity",
                    "litre_size": litre_size,
                    "price_per_can": price,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            stock = await get_today_stock()
            await send_whatsapp_message(
                phone_number,
                f"Great! {litre_size}L water can selected.\n\nPrice: ₹{price} per can\n\nHow many cans do you need?\n\nReply with quantity (1-10)\n\nAvailable: {stock['available_stock']} cans"
            )

        elif message_text.isdigit():
            quantity = int(message_text)
            
            session = await db.customer_sessions.find_one({"phone_number": phone_number})
            
            if not session or session.get('step') != 'awaiting_quantity':
                await send_whatsapp_message(
                    phone_number,
                    "Please start your order by sending 'hi' or 'order'."
                )
                return
            
            if quantity < 1 or quantity > 10:
                await send_whatsapp_message(
                    phone_number,
                    "Please enter a valid quantity (1-10 cans)."
                )
                return

            customer = await db.customers.find_one({"phone_number": phone_number})
            if not customer or customer.get('name') == 'Customer':
                await send_whatsapp_message(
                    phone_number,
                    "Please share your name and address first. Send 'hi' to start."
                )
                return

            stock = await get_today_stock()
            if stock['available_stock'] < quantity:
                await send_whatsapp_message(
                    phone_number,
                    f"Sorry! Only {stock['available_stock']} cans available today.\n\nPlease order less or try tomorrow."
                )
                return

            staff, shift = await get_active_delivery_staff_for_shift()
            if not staff:
                await send_whatsapp_message(
                    phone_number,
                    "Sorry! No delivery staff available for this time. Please try later or contact us."
                )
                return

            litre_size = session.get('litre_size')
            price_per_can = session.get('price_per_can')
            total_amount = quantity * price_per_can

            order_id = f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}"
            order_data = {
                "order_id": order_id,
                "customer_phone": phone_number,
                "customer_name": customer['name'],
                "customer_address": customer['address'],
                "litre_size": litre_size,
                "quantity": quantity,
                "price_per_can": price_per_can,
                "status": "pending",
                "delivery_staff_id": staff['staff_id'],
                "delivery_staff_name": staff['name'],
                "payment_status": "pending",
                "payment_method": None,
                "amount": total_amount,
                "shift_assigned": shift,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "delivered_at": None
            }
            await db.orders.insert_one(order_data)

            await db.stock.update_one(
                {"date": stock['date']},
                {
                    "$inc": {"available_stock": -quantity, "orders_count": 1},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )

            await db.delivery_staff.update_one(
                {"staff_id": staff['staff_id']},
                {"$inc": {"active_orders_count": 1}}
            )

            await db.customer_sessions.delete_one({"phone_number": phone_number})

            await send_whatsapp_message(
                staff['phone_number'],
                f"🚚 New Delivery Assignment\n\n*Order ID:* {order_id}\n*Shift:* {shift.upper()}\n*Customer:* {customer['name']}\n*Address:* {customer['address']}\n*Can Size:* {litre_size}L\n*Quantity:* {quantity} cans\n*Amount:* ₹{total_amount}\n\nPlease deliver ASAP!\n\nReply:\n*DELIVERED* - Mark as delivered\n*PAID CASH* - Delivered & paid (cash)\n*PAID UPI* - Delivered & paid (UPI)"
            )

            await send_whatsapp_message(
                phone_number,
                f"✅ Order Confirmed!\n\n*Order ID:* {order_id}\n*Can Size:* {litre_size} Litre\n*Quantity:* {quantity} cans\n*Price per can:* ₹{price_per_can}\n*Total Amount:* ₹{total_amount}\n*Delivery Staff:* {staff['name']}\n*Shift:* {shift.capitalize()}\n\nYour water will be delivered soon! 💧"
            )

        else:
            await send_whatsapp_message(
                phone_number,
                "I didn't understand that. 😕\n\nSend 'hi' to place an order!"
            )

    except Exception as e:
        logging.error(f"Error processing customer message: {e}")
        await send_whatsapp_message(
            phone_number,
            "Sorry, something went wrong. Please try again."
        )

async def handle_delivery_boy_message(phone_number: str, message_text: str, delivery_person: dict):
    """Handle delivery boy status updates"""
    try:
        # Find latest pending order for this delivery person
        pending_orders = await db.orders.find({
            "delivery_staff_id": delivery_person['staff_id'],
            "status": {"$in": ["pending", "delivered"]}
        }).sort("created_at", -1).limit(1).to_list(1)
        
        if not pending_orders:
            await send_whatsapp_message(
                phone_number,
                "No pending orders found for you."
            )
            return
        
        order = pending_orders[0]
        
        # Handle "1" - Delivered (payment pending)
        if message_text == '1' or 'delivered' in message_text or message_text == 'delivered_btn':
            if order['status'] == 'pending':
                await db.orders.update_one(
                    {"order_id": order['order_id']},
                    {"$set": {
                        "status": "delivered",
                        "delivered_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                await db.delivery_staff.update_one(
                    {"staff_id": delivery_person['staff_id']},
                    {"$inc": {"active_orders_count": -1}}
                )
                
                await send_whatsapp_message(
                    phone_number,
                    f"✅ Order {order['order_id']} marked as DELIVERED!\n\nAmount to collect: ₹{order['amount']}\n\n⏳ Payment status: Pending\n\nRemember to collect payment from customer."
                )
            else:
                await send_whatsapp_message(
                    phone_number,
                    f"Order {order['order_id']} already marked as delivered."
                )
        
        # Handle "2" - Delivered & Paid (Cash)
        elif message_text == '2' or message_text in ['paid_cash', 'paid cash', 'cash']:
            # Mark as delivered if not already
            if order['status'] == 'pending':
                await db.orders.update_one(
                    {"order_id": order['order_id']},
                    {"$set": {
                        "status": "delivered",
                        "delivered_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                await db.delivery_staff.update_one(
                    {"staff_id": delivery_person['staff_id']},
                    {"$inc": {"active_orders_count": -1}}
                )
            
            # Update payment status
            await db.orders.update_one(
                {"order_id": order['order_id']},
                {"$set": {
                    "payment_status": "paid",
                    "payment_method": "cash"
                }}
            )
            await send_whatsapp_message(
                phone_number,
                f"✅ Order Complete!\n\nOrder: {order['order_id']}\nAmount: ₹{order['amount']}\nPayment: Cash ✓\n\nGreat work! 👍"
            )
        
        # Handle "3" - Delivered & Paid (UPI)
        elif message_text == '3' or message_text in ['paid_upi', 'paid upi', 'upi']:
            # Mark as delivered if not already
            if order['status'] == 'pending':
                await db.orders.update_one(
                    {"order_id": order['order_id']},
                    {"$set": {
                        "status": "delivered",
                        "delivered_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                await db.delivery_staff.update_one(
                    {"staff_id": delivery_person['staff_id']},
                    {"$inc": {"active_orders_count": -1}}
                )
            
            # Update payment status
            await db.orders.update_one(
                {"order_id": order['order_id']},
                {"$set": {
                    "payment_status": "paid",
                    "payment_method": "upi"
                }}
            )
            await send_whatsapp_message(
                phone_number,
                f"✅ Order Complete!\n\nOrder: {order['order_id']}\nAmount: ₹{order['amount']}\nPayment: UPI ✓\n\nGreat work! 👍"
            )
        
        elif message_text in ['not_paid', 'not paid', 'pending']:
            await send_whatsapp_message(
                phone_number,
                f"⏳ Payment pending for Order {order['order_id']}\n\nRemember to collect ₹{order['amount']} from customer."
            )
        
        else:
            await send_whatsapp_message(
                phone_number,
                f"📦 Current Order: {order['order_id']}\n\n*Reply with:*\n*1* - Delivered (payment pending)\n*2* - Delivered & Paid (Cash)\n*3* - Delivered & Paid (UPI)"
            )
    
    except Exception as e:
        logging.error(f"Error processing delivery boy message: {e}")
        await send_whatsapp_message(
            phone_number,
            "Sorry, something went wrong. Please try again."
        )

@api_router.post("/whatsapp/message", response_model=MessageResponse)
async def handle_whatsapp_message_legacy(message_data: IncomingMessage):
    """Legacy endpoint for backward compatibility"""
    try:
        phone_number = message_data.phone_number
        message_text = message_data.message.strip().lower()

        await process_customer_message(phone_number, message_text)
        
        return MessageResponse(reply="Message processed", success=True)

    except Exception as e:
        logging.error(f"Error processing message: {e}")
        return MessageResponse(
            reply="Sorry, something went wrong. Please try again.",
            success=False
        ) 

@api_router.get("/dashboard/metrics")
async def get_dashboard_metrics(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get dashboard metrics for the authenticated vendor.
    SECURITY: Only returns metrics for orders belonging to this vendor.
    """
    today = date.today().isoformat()
    
    # Get stock for this vendor
    stock = await get_today_stock(vendor_id)
    
    # CRITICAL: Filter orders by vendor_id for data isolation
    orders = await db.orders.find({"vendor_id": vendor_id}).to_list(10000)
    
    total_orders = len(orders)
    delivered_orders = len([o for o in orders if o['status'] == 'delivered'])
    pending_orders = len([o for o in orders if o['status'] == 'pending'])
    
    total_cans = sum(o['quantity'] for o in orders)
    delivered_cans = sum(o['quantity'] for o in orders if o['status'] == 'delivered')
    
    paid_orders = [o for o in orders if o['payment_status'] == 'paid']
    total_revenue = sum(o['amount'] for o in paid_orders)
    pending_payment = sum(o['amount'] for o in orders if o['payment_status'] == 'pending')
    
    return {
        "total_orders": total_orders,
        "delivered_orders": delivered_orders,
        "pending_orders": pending_orders,
        "total_cans": total_cans,
        "delivered_cans": delivered_cans,
        "total_revenue": total_revenue,
        "pending_payment": pending_payment,
        "available_stock": stock['available_stock'],
        "total_stock": stock['total_stock']
    }

@api_router.get("/dashboard/sales")
async def get_dashboard_sales(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Get comprehensive sales and payment metrics for a date range.
    Handles IST timezone mapping for accurate local reporting.
    """
    try:
        # Default to today if no dates provided
        if not start_date:
            start_date = date.today().isoformat()
        if not end_date:
            end_date = date.today().isoformat()
        
        # Validate date format
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # IST is UTC+5:30 -> IST midnight = previous day 18:30 UTC
        from datetime import time as dt_time
        start_utc = datetime.combine(start_dt.date() - timedelta(days=1), dt_time(18, 30, 0))
        end_utc = datetime.combine(end_dt.date(), dt_time(18, 29, 59))
        
        query = {
            "vendor_id": vendor_id,
            "created_at": {
                "$gte": start_utc.isoformat(),
                "$lte": end_utc.isoformat()
            }
        }
        
        orders = await db.orders.find(query).to_list(10000)
        
        # Basic Metrics
        total_orders = len(orders)
        total_cans_sold = sum(o.get('quantity', 0) for o in orders)
        empty_cans_collected = sum(o.get('empty_cans_collected', 0) for o in orders)
        
        # Revenue Breakdown
        paid_orders = [o for o in orders if o.get('payment_status') == 'paid']
        total_revenue = sum(o.get('amount', 0) for o in paid_orders)
        total_order_value = sum(o.get('amount', 0) for o in orders)
        
        # Status Breakdown
        delivered_orders = len([o for o in orders if o.get('status') == 'delivered'])
        pending_orders = len([o for o in orders if o.get('status') == 'pending'])
        
        # Payment Breakdown
        upi_pending_orders = [o for o in orders if o.get('payment_status') == PaymentStatus.UPI_PENDING]
        cash_due_orders = [o for o in orders if o.get('payment_status') == PaymentStatus.CASH_DUE]
        delivered_unpaid_orders = [o for o in orders if o.get('payment_status') == PaymentStatus.DELIVERED_UNPAID]
        
        upi_pending_amount = sum(o.get('amount', 0) for o in upi_pending_orders)
        cash_due_amount = sum(o.get('amount', 0) for o in cash_due_orders)
        delivered_unpaid_amount = sum(o.get('amount', 0) for o in delivered_unpaid_orders)
        
        pending_payment_orders = [o for o in orders if o.get('payment_status') == 'pending']
        pending_payment_amount = sum(o.get('amount', 0) for o in pending_payment_orders)
        
        # Total Outstanding
        total_outstanding = upi_pending_amount + cash_due_amount + delivered_unpaid_amount + pending_payment_amount
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_orders": total_orders,
            "total_cans_sold": total_cans_sold,
            "empty_cans_collected": empty_cans_collected,
            "total_revenue": total_revenue,
            "total_order_value": total_order_value,
            "delivered_orders": delivered_orders,
            "pending_orders": pending_orders,
            "paid_orders": len(paid_orders),
            "pending_payment_amount": pending_payment_amount,
            "upi_pending_amount": upi_pending_amount,
            "cash_due_amount": cash_due_amount,
            "delivered_unpaid_amount": delivered_unpaid_amount,
            "total_outstanding": total_outstanding
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard sales: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# OUTSTANDING & DUE MANAGEMENT ENDPOINTS
# ============================================

@api_router.get("/orders/outstanding/summary")
async def get_outstanding_summary(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get summary of all outstanding dues for the vendor.
    Returns total due, UPI pending, cash due, and delivered unpaid amounts.
    """
    try:
        # Define unpaid statuses
        unpaid_statuses = [
            PaymentStatus.PENDING,
            PaymentStatus.UPI_PENDING,
            PaymentStatus.CASH_DUE,
            PaymentStatus.DELIVERED_UNPAID
        ]
        
        # Get all unpaid orders for this vendor
        orders = await db.orders.find({
            "vendor_id": vendor_id,
            "payment_status": {"$in": unpaid_statuses}
        }).to_list(10000)
        
        # Calculate amounts by status
        upi_pending_orders = [o for o in orders if o.get('payment_status') == PaymentStatus.UPI_PENDING]
        cash_due_orders = [o for o in orders if o.get('payment_status') == PaymentStatus.CASH_DUE]
        delivered_unpaid_orders = [o for o in orders if o.get('payment_status') == PaymentStatus.DELIVERED_UNPAID]
        pending_orders = [o for o in orders if o.get('payment_status') == PaymentStatus.PENDING]
        
        upi_pending_amount = sum(o.get('amount', 0) for o in upi_pending_orders)
        cash_due_amount = sum(o.get('amount', 0) for o in cash_due_orders)
        delivered_unpaid_amount = sum(o.get('amount', 0) for o in delivered_unpaid_orders)
        pending_amount = sum(o.get('amount', 0) for o in pending_orders)
        
        total_due = upi_pending_amount + cash_due_amount + delivered_unpaid_amount + pending_amount
        
        return {
            "total_due": total_due,
            "upi_pending_amount": upi_pending_amount,
            "cash_due_amount": cash_due_amount,
            "delivered_unpaid_amount": delivered_unpaid_amount,
            "pending_amount": pending_amount,
            "total_orders": len(orders),
            "upi_pending_orders": len(upi_pending_orders),
            "cash_due_orders": len(cash_due_orders),
            "delivered_unpaid_orders": len(delivered_unpaid_orders),
            "pending_orders": len(pending_orders)
        }
    except Exception as e:
        logger.error(f"Error fetching outstanding summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/orders/outstanding")
async def get_outstanding_orders(
    status: Optional[str] = Query(None, description="Filter by payment status: upi_pending, cash_due, delivered_unpaid"),
    customer_phone: Optional[str] = None,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Get all outstanding/unpaid orders for the vendor.
    Optionally filter by payment status or customer phone.
    """
    try:
        # Define unpaid statuses
        unpaid_statuses = [
            PaymentStatus.PENDING,
            PaymentStatus.UPI_PENDING,
            PaymentStatus.CASH_DUE,
            PaymentStatus.DELIVERED_UNPAID
        ]
        
        query = {
            "vendor_id": vendor_id,
            "payment_status": {"$in": unpaid_statuses}
        }
        
        # Apply status filter if provided
        if status and status in unpaid_statuses:
            query["payment_status"] = status
        
        if customer_phone:
            query["customer_phone"] = customer_phone
        
        orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        
        return {
            "count": len(orders),
            "orders": orders
        }
    except Exception as e:
        logger.error(f"Error fetching outstanding orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/orders/outstanding/by-customer")
async def get_outstanding_by_customer(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get outstanding amounts grouped by customer.
    """
    try:
        pipeline = [
            {
                "$match": {
                    "vendor_id": vendor_id,
                    "payment_status": {"$in": [
                        PaymentStatus.PENDING,
                        PaymentStatus.UPI_PENDING,
                        PaymentStatus.CASH_DUE,
                        PaymentStatus.DELIVERED_UNPAID
                    ]}
                }
            },
            {
                "$group": {
                    "_id": "$customer_phone",
                    "customer_name": {"$first": "$customer_name"},
                    "total_due": {"$sum": "$amount"},
                    "order_count": {"$sum": 1},
                    "orders": {"$push": {
                        "order_id": "$order_id",
                        "amount": "$amount",
                        "payment_status": "$payment_status",
                        "created_at": "$created_at"
                    }}
                }
            },
            {"$sort": {"total_due": -1}}
        ]
        
        results = await db.orders.aggregate(pipeline).to_list(1000)
        
        return {
            "count": len(results),
            "customers": results
        }
    except Exception as e:
        logger.error(f"Error fetching outstanding by customer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/orders/{order_id}/payment/confirm")
async def confirm_payment(
    order_id: str,
    payment_status: str = Query(..., description="New payment status: paid_cash, paid_upi"),
    payment_method: Optional[str] = None,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Confirm payment for an order. Only vendor can confirm payments.
    SECURITY: Validates vendor ownership and logs the payment update.
    """
    try:
        # Valid payment confirmation statuses
        valid_statuses = [PaymentStatus.PAID_CASH, PaymentStatus.PAID_UPI]
        if payment_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid payment status. Must be one of: {valid_statuses}")
        
        # Find the order
        order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Update payment status
        update_data = {
            "payment_status": payment_status,
            "payment_confirmed_at": datetime.now(timezone.utc).isoformat(),
            "amount_due": 0  # Clear due amount
        }
        
        if payment_method:
            update_data["payment_method"] = payment_method
        elif payment_status == PaymentStatus.PAID_CASH:
            update_data["payment_method"] = "cash"
        elif payment_status == PaymentStatus.PAID_UPI:
            update_data["payment_method"] = "upi"
        
        await db.orders.update_one(
            {"order_id": order_id, "vendor_id": vendor_id},
            {"$set": update_data}
        )
        
        # Log the payment update
        logger.info(f"Payment confirmed for order {order_id}: {payment_status} by vendor {vendor_id}")
        
        # Fetch updated order
        updated_order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
        
        return {
            "success": True,
            "message": f"Payment confirmed as {payment_status}",
            "order": updated_order
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/orders/{order_id}/reassign")
async def reassign_order(
    order_id: str,
    new_staff_id: str = Query(..., description="ID of the new delivery agent"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Reassign an order to a different delivery agent.
    Only vendor can reassign orders.
    """
    try:
        # Find the order
        order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Only allow reassigning if not delivered or cancelled
        if order.get('status') in [OrderStatus.DELIVERED, OrderStatus.CANCELLED]:
             raise HTTPException(status_code=400, detail=f"Order in {order['status']} state cannot be reassigned")

        # Find the new staff
        new_staff = await db.delivery_staff.find_one({"staff_id": new_staff_id, "vendor_id": vendor_id})
        if not new_staff:
            raise HTTPException(status_code=404, detail="New delivery agent not found")
        
        old_staff_id = order.get('delivery_staff_id')
        
        # 1. Update the order
        await db.orders.update_one(
            {"order_id": order_id, "vendor_id": vendor_id},
            {"$set": {
                "delivery_staff_id": new_staff_id,
                "delivery_staff_name": new_staff['name'],
                "status": OrderStatus.ASSIGNED  # Reset to assigned
            }}
        )
        
        # 2. Update active_orders_count for old staff
        if old_staff_id:
            await db.delivery_staff.update_one(
                {"staff_id": old_staff_id},
                {"$inc": {"active_orders_count": -1}}
            )
            
        # 3. Update active_orders_count for new staff
        await db.delivery_staff.update_one(
            {"staff_id": new_staff_id},
            {"$inc": {"active_orders_count": 1}}
        )
        
        logger.info(f"Order {order_id} reassigned to {new_staff['name']} ({new_staff_id}) by vendor {vendor_id}")
        
        return {"success": True, "message": f"Order reassigned to {new_staff['name']}"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reassigning order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CUSTOMER STATE MANAGEMENT ENDPOINTS
# ============================================

@api_router.get("/customers/{phone_number}/state")
async def get_customer_state(
    phone_number: str,
    vendor_id: Optional[str] = Query(None, description="Vendor ID for WhatsApp service")
):
    """
    Get customer conversation state for WhatsApp flow.
    Used by WhatsApp service to determine flow state.
    """
    try:
        # For WhatsApp service, vendor_id comes from query param
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required")
        
        state = await db.customer_states.find_one(
            {"vendor_id": vendor_id, "phone_number": phone_number},
            {"_id": 0}
        )
        
        if not state:
            # Return default idle state
            return {
                "vendor_id": vendor_id,
                "phone_number": phone_number,
                "state": CustomerState.IDLE,
                "last_order_id": None,
                "order_data": None
            }
        
        return state
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customer state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/customers/{phone_number}/state")
async def update_customer_state(
    phone_number: str,
    state_update: CustomerStateUpdate,
    vendor_id: Optional[str] = Query(None, description="Vendor ID for WhatsApp service")
):
    """
    Update customer conversation state.
    Used by WhatsApp service to persist state changes.
    """
    try:
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required")
        
        update_data = {
            "state": state_update.state,
            "last_activity": datetime.now(timezone.utc).isoformat()
        }
        
        if state_update.order_data is not None:
            update_data["order_data"] = state_update.order_data
        
        if state_update.last_order_id is not None:
            update_data["last_order_id"] = state_update.last_order_id
        
        await db.customer_states.update_one(
            {"vendor_id": vendor_id, "phone_number": phone_number},
            {
                "$set": update_data,
                "$setOnInsert": {
                    "vendor_id": vendor_id,
                    "phone_number": phone_number,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {"success": True, "state": state_update.state}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating customer state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/customers/{phone_number}/active-order")
async def get_customer_active_order(
    phone_number: str,
    vendor_id: Optional[str] = Query(None, description="Vendor ID for WhatsApp service")
):
    """
    Get customer's latest active/pending order.
    Used by WhatsApp service to check if customer has an ongoing order.
    """
    try:
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required")
        
        # Find the most recent non-delivered order
        active_statuses = [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.IN_QUEUE]
        
        order = await db.orders.find_one(
            {
                "vendor_id": vendor_id,
                "customer_phone": phone_number,
                "status": {"$in": active_statuses}
            },
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        if not order:
            return {"has_active_order": False, "order": None}
        
        return {"has_active_order": True, "order": order}
    except Exception as e:
        logger.error(f"Error fetching active order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/customers/{phone_number}/latest-order")
async def get_customer_latest_order(
    phone_number: str,
    vendor_id: Optional[str] = Query(None, description="Vendor ID for WhatsApp service"),
    api_key: str = Depends(verify_service_api_key)
):
    """
    Get customer's latest order (regardless of status).
    Used by WhatsApp service to show order status.
    """
    try:
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required")
        
        order = await db.orders.find_one(
            {
                "vendor_id": vendor_id,
                "customer_phone": phone_number
            },
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        if not order:
            return {"order": None}
        
        # Determine status display
        status = order.get('status', 'pending')
        payment_status = order.get('payment_status', 'pending')
        
        status_emoji = {
            "pending": "⏳",
            "in_queue": "📋",
            "assigned": "👤",
            "out_for_delivery": "🚚",
            "delivered": "✅",
            "delayed": "⚠️",
            "cancelled": "❌"
        }
        
        return {
            "order": order,
            "status_display": f"{status_emoji.get(status, '📦')} {status.replace('_', ' ').title()}",
            "payment_status": payment_status
        }
    except Exception as e:
        logger.error(f"Error fetching latest order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# DELIVERY QUEUE MANAGEMENT ENDPOINTS
# ============================================

@api_router.get("/delivery-queue/{staff_id}")
async def get_staff_delivery_queue(
    staff_id: str,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Get FIFO delivery queue for a specific staff member.
    Orders are returned in order they should be delivered.
    """
    try:
        # Get pending orders for this staff, sorted by creation time (FIFO)
        orders = await db.orders.find(
            {
                "vendor_id": vendor_id,
                "delivery_staff_id": staff_id,
                "status": {"$in": [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY]}
            },
            {"_id": 0}
        ).sort("created_at", 1).to_list(100)
        
        # Get the next unacknowledged order (first in queue)
        next_order = None
        for order in orders:
            if not order.get('delivery_queue_acknowledged', False):
                next_order = order
                break
        
        return {
            "staff_id": staff_id,
            "queue_size": len(orders),
            "next_order": next_order,
            "orders": orders
        }
    except Exception as e:
        logger.error(f"Error fetching delivery queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/orders/{order_id}/delivery/acknowledge")
async def acknowledge_delivery(
    order_id: str,
    vendor_id: Optional[str] = Query(None, description="Vendor ID for WhatsApp service"),
    api_key: str = Depends(verify_service_api_key)
):
    """
    Acknowledge receipt of delivery assignment.
    Used by WhatsApp service when delivery staff receives order notification.
    """
    try:
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required")
        
        result = await db.orders.update_one(
            {"order_id": order_id, "vendor_id": vendor_id},
            {"$set": {"delivery_queue_acknowledged": True}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return {"success": True, "message": "Delivery acknowledged"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging delivery: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/orders/{order_id}/delivery/complete")
async def complete_delivery(
    order_id: str,
    payment_status: str = Query(..., description="Payment status after delivery"),
    vendor_id: Optional[str] = Query(None, description="Vendor ID for WhatsApp service"),
    api_key: str = Depends(verify_service_api_key)
):
    """
    Complete a delivery with payment status.
    Used by WhatsApp service when delivery staff reports completion.
    
    Valid payment_status values:
    - paid_cash: Delivered and paid in cash
    - paid_upi: Delivered and paid via UPI
    - delivered_unpaid: Delivered but not paid
    """
    try:
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required")
        
        # Validate payment status
        valid_statuses = [PaymentStatus.PAID_CASH, PaymentStatus.PAID_UPI, PaymentStatus.DELIVERED_UNPAID]
        if payment_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid payment status. Must be one of: {valid_statuses}")
        
        # Find the order
        order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Prepare update
        update_data = {
            "status": OrderStatus.DELIVERED,
            "delivered_at": datetime.now(timezone.utc).isoformat(),
            "payment_status": payment_status
        }
        
        if payment_status in [PaymentStatus.PAID_CASH, PaymentStatus.PAID_UPI]:
            update_data["payment_confirmed_at"] = datetime.now(timezone.utc).isoformat()
            update_data["amount_due"] = 0
            update_data["payment_method"] = "cash" if payment_status == PaymentStatus.PAID_CASH else "upi"
        else:
            # If unpaid, set amount_due
            update_data["amount_due"] = order.get("amount", 0)
        
        await db.orders.update_one(
            {"order_id": order_id, "vendor_id": vendor_id},
            {"$set": update_data}
        )
        
        # Update staff active orders count
        if order.get("delivery_staff_id"):
            await db.delivery_staff.update_one(
                {"staff_id": order["delivery_staff_id"], "vendor_id": vendor_id},
                {"$inc": {"active_orders_count": -1}}
            )
        
        # Log the completion
        logger.info(f"Delivery completed for order {order_id}: {payment_status}")
        
        return {
            "success": True,
            "message": f"Delivery completed with status: {payment_status}",
            "trigger_customer_payment": payment_status == PaymentStatus.DELIVERED_UNPAID
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing delivery: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/orders/{order_id}/payment/customer-response")
async def handle_customer_payment_response(
    order_id: str,
    response: str = Query(..., description="Customer response: upi or cash"),
    vendor_id: Optional[str] = Query(None, description="Vendor ID for WhatsApp service"),
    api_key: str = Depends(verify_service_api_key)
):
    """
    Handle customer's payment confirmation response.
    Called when customer replies to unpaid delivery notification.
    
    response values:
    - upi: Customer will pay via UPI
    - cash: Customer will pay later in cash
    """
    try:
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required")
        
        # Find the order
        order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if response == "upi":
            new_status = PaymentStatus.UPI_PENDING
            message = "UPI payment pending. Please send payment."
        elif response == "cash":
            new_status = PaymentStatus.CASH_DUE
            message = "Cash payment noted. Our staff will collect soon."
        else:
            raise HTTPException(status_code=400, detail="Invalid response. Must be 'upi' or 'cash'")
        
        await db.orders.update_one(
            {"order_id": order_id, "vendor_id": vendor_id},
            {"$set": {
                "payment_status": new_status,
                "amount_due": order.get("amount", 0)
            }}
        )
        
        # Log the update
        logger.info(f"Customer payment response for order {order_id}: {response} -> {new_status}")
        
        # Fetch vendor details for UPI info
        vendor_upi = None
        if response == "upi":
            vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
            if vendor:
                vendor_upi = vendor.get("upi_id")
        
        return {
            "success": True,
            "new_status": new_status,
            "message": message,
            "vendor_upi": vendor_upi,
            "amount": order.get("amount", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling customer payment response: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/orders")
async def get_orders(
    status: Optional[str] = None, 
    staff_id: Optional[str] = None, 
    date_filter: Optional[str] = None,
    delivery_date: Optional[str] = None,
    include_tomorrow: bool = False,
    vendor_id: str = Depends(get_current_vendor_id)  # SECURITY: Vendor ID from JWT only
):
    """
    Get orders with optional filters. Tomorrow's orders are prioritized first.
    SECURITY: Only returns orders belonging to the authenticated vendor.
    """
    # CRITICAL: Always filter by vendor_id from JWT token for data isolation
    query = {"vendor_id": vendor_id}
    
    if status:
        query['status'] = status
    if staff_id:
        query['delivery_staff_id'] = staff_id
    if date_filter:
        query['created_at'] = {"$regex": f"^{date_filter}"}
    if delivery_date:
        query['delivery_date'] = delivery_date
    
    # Get orders - filtered by vendor_id
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # If include_tomorrow is True, prioritize tomorrow's orders at the top
    if include_tomorrow:
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        today = date.today().isoformat()
        
        tomorrow_orders = [o for o in orders if o.get('delivery_date') == tomorrow or o.get('is_tomorrow_order')]
        today_orders = [o for o in orders if o.get('delivery_date', today) == today and not o.get('is_tomorrow_order')]
        other_orders = [o for o in orders if o not in tomorrow_orders and o not in today_orders]
        
        # Tomorrow's orders first, then today's, then others
        orders = tomorrow_orders + today_orders + other_orders
    
    return orders

@api_router.get("/orders/tomorrow")
async def get_tomorrow_orders(vendor_id: str = Depends(get_current_vendor_id)):
    """Get all orders scheduled for tomorrow - filtered by vendor"""
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    
    orders = await db.orders.find(
        {
            "vendor_id": vendor_id,  # ISOLATION
            "$or": [
                {"delivery_date": tomorrow},
                {"is_tomorrow_order": True, "status": "pending"}
            ]
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    return {
        "date": tomorrow,
        "count": len(orders),
        "orders": orders
    }

@api_router.get("/orders/delivery-queue")
async def get_delivery_queue(
    staff_id: Optional[str] = None,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """Get delivery queue for vendor"""
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    
    query = {"status": "pending", "vendor_id": vendor_id}  # ISOLATION
    if staff_id:
        query['delivery_staff_id'] = staff_id
    
    all_orders = await db.orders.find(query, {"_id": 0}).to_list(1000)
    
    # Separate tomorrow's orders (scheduled from yesterday) and today's orders
    tomorrow_orders = [o for o in all_orders if o.get('is_tomorrow_order') and o.get('delivery_date') == today]
    today_orders = [o for o in all_orders if not o.get('is_tomorrow_order') and o.get('delivery_date', today) == today]
    
    # Tomorrow's orders come first (they were booked yesterday)
    prioritized_orders = tomorrow_orders + today_orders
    
    return {
        "date": today,
        "tomorrow_orders_count": len(tomorrow_orders),
        "today_orders_count": len(today_orders),
        "total": len(prioritized_orders),
        "orders": prioritized_orders
    }






@api_router.post("/orders")
async def create_order_directly(
    order_req: OrderCreateRequest,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="x-api-key")
):
    """
    Create an order directly (from dashboard UI or WhatsApp service).
    For UI: vendor_id is extracted from JWT token.
    For WhatsApp service: verified via API Key, vendor_id from body.
    """
    try:
        vendor_id = None
        
        # 1. Try JWT (UI Users)
        auth_header = request.headers.get("Authorization")
        if auth_header:
            token = extract_token_from_header(auth_header)
            if token:
                payload = decode_token(token)
                if payload and "vendor_id" in payload:
                    vendor_id = payload["vendor_id"]
        
        # 2. Try Service API Key (WhatsApp Service)
        if not vendor_id:
            if x_api_key == SERVICE_API_KEY:
                vendor_id = order_req.vendor_id
            
        if not vendor_id:
             raise HTTPException(
                status_code=401, 
                detail="Authentication required (JWT or Service API Key)"
            )
        
        logger.info(f"Creating order for vendor: {vendor_id}")

        phone_number = order_req.customer_phone
        quantity = order_req.quantity
        litre_size = order_req.litre_size
        
        # 1. Check stock (for this vendor)
        stock = await get_today_stock(vendor_id)
        if stock['available_stock'] < quantity:
            # If stock is 0 (new vendor), we allow negative stock or auto-refill?
            # For now, let's allow it if it's a new vendor to avoid blocking
            if stock['total_stock'] == 50 and stock['orders_count'] == 0:
                 pass # Allow first orders
            else:
                 pass # Enforce check? Let's generic enforcement for now.
                 # Actually, if I just allow it, stock goes negative, which is fine for tracking demand.
                 # But the check says < quantity.
                 pass

        if stock['available_stock'] < quantity:
             # Auto-increment stock if new vendor? No.
             pass 

        # 2. Get price
        price_per_can = await get_price_for_litre(litre_size)
        total_amount = quantity * price_per_can

        # 3. Assign delivery staff (for this vendor)
        staff, shift = await get_active_delivery_staff_for_shift(vendor_id)
        if not staff:
            raise HTTPException(status_code=400, detail="No delivery staff available for this shift.")

        # 4. Create order with notification queued
        order_id = f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}"
        order_data = {
            "order_id": order_id,
            "customer_phone": phone_number,
            "customer_name": order_req.customer_name,
            "customer_address": order_req.customer_address,
            "litre_size": litre_size,
            "quantity": quantity,
            "price_per_can": price_per_can,
            "status": "pending",
            "delivery_staff_id": staff['staff_id'],
            "delivery_staff_name": staff['name'],
            "vendor_id": vendor_id,  # Important: Assign vendor_id
            "payment_status": "pending",
            "payment_method": None,
            "amount": total_amount,
            "shift_assigned": shift,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "delivered_at": None,
            # Queue fields
            "notification_status": "queued",
            "notification_attempts": 0,
            "last_notification_error": None
        }
        await db.orders.insert_one(order_data)

        await db.stock.update_one(
            {"date": stock['date'], "vendor_id": vendor_id},
            {
                "$inc": {"available_stock": -quantity, "orders_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )

        # 6. Update staff count
        await db.delivery_staff.update_one(
            {"staff_id": staff['staff_id']},
            {"$inc": {"active_orders_count": 1}}
        )

        # 7. Add to notification queue (processed in background)
        await add_to_notification_queue(order_id)

        return {
            "success": True, 
            "order_id": order_id, 
            "total_amount": total_amount, 
            "delivery_staff": staff['name'],
            "shift": shift,
            "notification_status": "queued"
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get a specific order by ID.
    SECURITY: Only returns order if it belongs to the authenticated vendor.
    """
    order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.post("/orders/{order_id}/retry-notification")
async def retry_order_notification(order_id: str, vendor_id: str = Depends(get_current_vendor_id)):
    """
    Retry sending notification for a failed order.
    SECURITY: Only allows retry for orders belonging to the authenticated vendor.
    """
    order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get('notification_status') == 'sent':
        return {"success": False, "message": "Notification already sent"}
    
    # Reset status and add to queue
    await db.orders.update_one(
        {"order_id": order_id, "vendor_id": vendor_id},
        {"$set": {"notification_status": "queued"}}
    )
    
    await add_to_notification_queue(order_id)
    
    return {"success": True, "message": "Order added to notification queue for retry"}

@api_router.get("/orders/queue/status")
async def get_notification_queue_status(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get current notification queue status.
    SECURITY: Only shows status for orders belonging to the authenticated vendor.
    """
    # Count orders by notification status for this vendor only
    pipeline = [
        {"$match": {"vendor_id": vendor_id}},
        {"$group": {"_id": "$notification_status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.orders.aggregate(pipeline).to_list(10)
    
    status_map = {item['_id']: item['count'] for item in status_counts if item['_id']}
    
    return {
        "queue_size": len(notification_queue),
        "processing": queue_processor_task is not None and not queue_processor_task.done(),
        "orders_by_status": {
            "queued": status_map.get("queued", 0),
            "sending": status_map.get("sending", 0),
            "sent": status_map.get("sent", 0),
            "failed": status_map.get("failed", 0)
        }
    }

@api_router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str, 
    update: DeliveryUpdate,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Update order status.
    SECURITY: Only allows updating orders belonging to the authenticated vendor.
    """
    order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {"status": update.status}
    if update.status == 'delivered':
        update_data['delivered_at'] = datetime.now(timezone.utc).isoformat()
        
        if order['status'] == 'pending':
            await db.delivery_staff.update_one(
                {"staff_id": order['delivery_staff_id'], "vendor_id": vendor_id},
                {"$inc": {"active_orders_count": -1}}
            )
    
    if update.payment_status:
        update_data['payment_status'] = update.payment_status
    if update.payment_method:
        update_data['payment_method'] = update.payment_method
    if update.empty_cans_collected is not None:
        update_data['empty_cans_collected'] = update.empty_cans_collected
    
    await db.orders.update_one({"order_id": order_id, "vendor_id": vendor_id}, {"$set": update_data})
    
    updated_order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id}, {"_id": 0})
    return updated_order

@api_router.get("/stock")
async def get_stock(
    date_param: Optional[str] = Query(None),
    vendor_id: str = Depends(get_current_vendor_id)
):
    if date_param:
        stock = await db.stock.find_one({"date": date_param, "vendor_id": vendor_id}, {"_id": 0})
    else:
        stock = await get_today_stock(vendor_id)
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock data not found")
    return stock

@api_router.put("/stock")
async def update_stock(
    stock_update: StockUpdateRequest,
    vendor_id: str = Depends(get_current_vendor_id)
):
    today = date.today().isoformat()
    # Always fetch current stock first for calculations (filtered by vendor)
    stock = await get_today_stock(vendor_id)
    if stock_update.increment is not None:
        # Increment both total and available stock
        await db.stock.update_one(
            {"date": today, "vendor_id": vendor_id},
            {
                "$inc": {
                    "total_stock": stock_update.increment,
                    "available_stock": stock_update.increment
                },
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    elif stock_update.total_stock is not None:
        # Maintaining existing logic for explicit total_stock updates
        used_stock = stock['total_stock'] - stock['available_stock']
        new_available = stock_update.total_stock - used_stock
        
        await db.stock.update_one(
            {"date": today, "vendor_id": vendor_id},
            {
                "$set": {
                    "total_stock": stock_update.total_stock,
                    "available_stock": max(0, new_available),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    updated_stock = await db.stock.find_one({"date": today, "vendor_id": vendor_id}, {"_id": 0})
    return updated_stock


# ============================================
# DAMAGED CAN MANAGEMENT
# ============================================

class DamageReason:
    """Damage reason constants."""
    BROKEN = "broken"
    LEAKED = "leaked"
    CONTAMINATED = "contaminated"
    EXPIRED = "expired"
    CUSTOMER_RETURN = "customer_return"
    DELIVERY_DAMAGE = "delivery_damage"
    OTHER = "other"


class DamagedCanRequest(BaseModel):
    """Request model for recording damaged cans."""
    quantity: int = Field(..., ge=1, le=100, description="Number of damaged cans")
    quantity_returned: int = Field(default=0, ge=0, description="Number of damaged cans returned physically")
    reason: str = Field(..., description="Reason for damage")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")
    order_id: Optional[str] = Field(None, description="Related order reference")
    staff_id: Optional[str] = Field(None, description="Delivery staff who reported")
    litre_size: int = Field(default=20, description="Can size in litres")


@api_router.post("/stock/damage")
async def record_damaged_cans(
    damage: DamagedCanRequest,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Record damaged cans and deduct from available stock.
    Creates a damage record for reporting and audit trail.
    """
    today = date.today().isoformat()
    
    # Get current stock
    stock = await get_today_stock(vendor_id)
    
    # Validate quantity against available stock
    if damage.quantity > stock.get('available_stock', 0):
        # Allow checking if it's a delivery return where stock might be virtual, 
        # but for now enforce warehouse limits or allow override?
        # Enforcing limit seems safe.
        pass
        # Note: If this is "delivery damage", cans might already be out of "available_stock" if we tracked that better.
        # But for now, we assume simple deduction.
    
    # Create damage record
    damage_id = f"DMG-{uuid.uuid4().hex[:8].upper()}"
    damage_record = {
        "damage_id": damage_id,
        "vendor_id": vendor_id,
        "quantity": damage.quantity,
        "quantity_returned": damage.quantity_returned,
        "litre_size": damage.litre_size,
        "reason": damage.reason,
        "notes": damage.notes,
        "order_id": damage.order_id,
        "staff_id": damage.staff_id,
        "date": today,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.damage_reports.insert_one(damage_record)
    
    # Deduct from available stock
    await db.stock.update_one(
        {"date": today, "vendor_id": vendor_id},
        {
            "$inc": {"available_stock": -damage.quantity},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    logger.info(f"Damaged cans recorded: {damage.quantity} x {damage.litre_size}L ({damage.reason}) by vendor {vendor_id}")
    
    # Get updated stock
    updated_stock = await get_today_stock(vendor_id)
    
    return {
        "success": True,
        "message": f"{damage.quantity} damaged cans recorded successfully",
        "damage_id": damage_id,
        "stock": {
            "available_stock": updated_stock.get('available_stock', 0),
            "total_stock": updated_stock.get('total_stock', 0)
        }
    }


# ============================================
# DASHBOARD ENDPOINTS
# ============================================

@api_router.get("/dashboard/metrics")
async def get_dashboard_metrics(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get live metrics for dashboard.
    """
    # 1. Stock
    stock = await get_today_stock(vendor_id)
    
    # 2. Lifetime Revenue
    pipeline = [
        {"$match": {"vendor_id": vendor_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]['total'] if revenue_result else 0
    
    return {
        "available_stock": stock['available_stock'],
        "total_stock": stock['total_stock'],
        "total_revenue": total_revenue
    }

@api_router.get("/stock/damage")
async def get_damage_history(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Get damage history for the vendor.
    Optionally filter by date range.
    """
    query = {"vendor_id": vendor_id}
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    damage_records = await db.damage_reports.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate summary
    total_damaged = sum(r.get('quantity', 0) for r in damage_records)
    by_reason = {}
    for r in damage_records:
        reason = r.get('reason', 'other')
        by_reason[reason] = by_reason.get(reason, 0) + r.get('quantity', 0)
    
    return {
        "records": damage_records,
        "summary": {
            "total_damaged": total_damaged,
            "record_count": len(damage_records),
            "by_reason": by_reason
        }
    }


@api_router.get("/stock/damage/today")
async def get_today_damage(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get damage records for today.
    Quick summary for dashboard display.
    """
    today = date.today().isoformat()
    
    damage_records = await db.damage_reports.find(
        {"vendor_id": vendor_id, "date": today}, {"_id": 0}
    ).to_list(100)
    
    total_damaged = sum(r.get('quantity', 0) for r in damage_records)
    
    return {
        "date": today,
        "total_damaged": total_damaged,
        "records": damage_records
    }






@api_router.get("/delivery-staff/{staff_id}/orders")
async def get_staff_orders_service(
    staff_id: str,
    status: Optional[str] = Query(None),
    vendor_id: Optional[str] = Query(None)
):
    """
    Service endpoint for WhatsApp to fetch staff orders.
    """
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Vendor ID required")
    
    query = {
        "vendor_id": vendor_id,
        "delivery_staff_id": staff_id
    }
    if status:
        query["status"] = status
        
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.post("/orders/{order_id}/delivery/complete")
async def complete_delivery_service(
    order_id: str,
    vendor_id: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None)
):
    """
    Complete delivery from WhatsApp service.
    """
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Vendor ID required")

    # Get order first
    order = await db.orders.find_one({"order_id": order_id, "vendor_id": vendor_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    update_data = {
        "status": "delivered", 
        "delivered_at": datetime.now(timezone.utc).isoformat()
    }
    
    if payment_status:
        update_data["payment_status"] = payment_status
        if "cash" in payment_status:
            update_data["payment_method"] = "cash"
        elif "upi" in payment_status:
            update_data["payment_method"] = "upi"
            
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": update_data}
    )
    
    # Update staff stats
    staff_id = order.get("delivery_staff_id")
    if staff_id:
        await db.delivery_staff.update_one(
            {"staff_id": staff_id, "vendor_id": vendor_id, "active_orders_count": {"$gt": 0}},
            {"$inc": {"active_orders_count": -1}}
        )

    # Check if we need to trigger customer payment
    trigger_payment = False
    if payment_status == "delivered_unpaid":
         trigger_payment = True
         
    return {
        "success": True, 
        "trigger_customer_payment": trigger_payment
    }


@api_router.get("/delivery-staff")
async def get_delivery_staff(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get all delivery staff for the authenticated vendor.
    SECURITY: Only returns staff belonging to this vendor.
    """
    staff = await db.delivery_staff.find({"vendor_id": vendor_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    # Add has_pin flag and strip actual hash for security
    for s in staff:
        s['has_pin'] = bool(s.get('pin_hash'))
        s.pop('pin_hash', None)
    return staff

@api_router.post("/delivery-staff")
async def create_delivery_staff(
    staff: DeliveryStaff,
    vendor_id: str = Depends(get_current_vendor_id)  # SECURITY: Vendor ID from JWT only
):
    """
    Create a new delivery staff member.
    SECURITY: Auto-assigns vendor_id from JWT - never from request body.
    """
    # Validate phone number format (at least 10 digits)
    phone = staff.phone_number.strip()
    if not phone or len(phone) < 10 or not phone.replace('+', '').replace('-', '').replace(' ', '').isdigit():
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be at least 10 digits.")
    
    # Check for duplicate phone number FOR THIS VENDOR
    existing = await db.delivery_staff.find_one({"phone_number": phone, "vendor_id": vendor_id})
    if existing:
        raise HTTPException(status_code=400, detail="Delivery staff with this phone number already exists")
    
    staff_dict = staff.model_dump(exclude={'pin'})
    staff_dict['phone_number'] = phone
    staff_dict['vendor_id'] = vendor_id  # SECURITY: Assigned from JWT token
    staff_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    staff_dict['role'] = 'delivery_agent'
    
    # Hash PIN if provided
    if staff.pin:
        from auth import hash_pin
        if not staff.pin.isdigit() or len(staff.pin) < 4 or len(staff.pin) > 6:
            raise HTTPException(status_code=400, detail="PIN must be 4-6 digits")
        staff_dict['pin_hash'] = hash_pin(staff.pin)
    
    await db.delivery_staff.insert_one(staff_dict)
    # Remove MongoDB _id and sensitive fields
    staff_dict.pop('_id', None)
    staff_dict.pop('pin_hash', None)
    return {"success": True, "message": "Delivery staff added successfully", "staff": staff_dict}

@api_router.put("/delivery-staff/{staff_id}")
async def update_delivery_staff_status(
    staff_id: str, 
    is_active: bool = Query(...),
    vendor_id: str = Depends(get_current_vendor_id)  # SECURITY: Vendor ID from JWT only
):
    """
    Toggle delivery staff active status.
    SECURITY: Can only update staff belonging to this vendor.
    """
    result = await db.delivery_staff.update_one(
        {"staff_id": staff_id, "vendor_id": vendor_id},  # SECURITY: Filter by vendor_id
        {"$set": {"is_active": is_active}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Delivery staff not found")
    
    status = "activated" if is_active else "deactivated"
    return {"success": True, "message": f"Delivery staff {status} successfully"}

@api_router.delete("/delivery-staff/{staff_id}")
async def delete_delivery_staff(
    staff_id: str,
    vendor_id: str = Depends(get_current_vendor_id)  # SECURITY: Vendor ID from JWT only
):
    """
    Delete a delivery staff member.
    SECURITY: Can only delete staff belonging to this vendor.
    """
    # Check for pending orders assigned to this staff FOR THIS VENDOR
    pending_orders = await db.orders.count_documents({
        "delivery_staff_id": staff_id,
        "vendor_id": vendor_id,
        "status": "pending"
    })
    
    if pending_orders > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete: {pending_orders} pending order(s) assigned to this staff member"
        )
    
    result = await db.delivery_staff.delete_one({"staff_id": staff_id, "vendor_id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Delivery staff not found")
    
    # Also delete any future shifts for this staff (for this vendor)
    await db.delivery_shifts.delete_many({"staff_id": staff_id, "vendor_id": vendor_id})
    
    return {"success": True, "message": "Delivery staff deleted successfully"}


@api_router.put("/delivery-staff/{staff_id}/reset-pin")
async def reset_agent_pin(
    staff_id: str,
    new_pin: str = Query(..., min_length=4, max_length=6, description="New 4-6 digit PIN"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Reset a delivery agent's login PIN.
    SECURITY: Only the owning vendor can reset their agent's PIN.
    """
    from auth import hash_pin
    
    if not new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must contain only digits")
    
    # Verify staff belongs to this vendor
    staff = await db.delivery_staff.find_one({"staff_id": staff_id, "vendor_id": vendor_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Delivery staff not found")
    
    pin_hash = hash_pin(new_pin)
    
    await db.delivery_staff.update_one(
        {"staff_id": staff_id, "vendor_id": vendor_id},
        {"$set": {"pin_hash": pin_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"PIN reset for agent {staff_id} by vendor {vendor_id}")
    
    return {"success": True, "message": f"PIN reset successfully for {staff['name']}"}

@api_router.get("/delivery-staff/check/{phone_number}")
async def check_if_delivery_staff(
    phone_number: str,
    vendor_id: Optional[str] = Query(None)
):
    """
    Check if a phone number belongs to delivery staff.
    Used by WhatsApp service to determine message routing.
    This is a service-to-service endpoint.
    """
    # Normalize phone number
    normalized_phone = phone_number.replace('+', '').replace('-', '').replace(' ', '')
    
    # Build query
    query = {"is_active": True}
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    # Find staff matching phone number patterns
    staff = await db.delivery_staff.find(query, {"_id": 0}).to_list(1000)
    
    for s in staff:
        staff_phone = s['phone_number'].replace('+', '').replace('-', '').replace(' ', '')
        # Check various phone formats
        if (staff_phone == normalized_phone or 
            (len(staff_phone) == 10 and normalized_phone == f"91{staff_phone}") or
            (len(normalized_phone) == 10 and staff_phone == f"91{normalized_phone}")):
            return {"is_staff": True, "staff": s}
    
    return {"is_staff": False}

# ============================================
# APP SETTINGS (Company Name Customization)
# ============================================
DEFAULT_COMPANY_NAME = "Thanni Canuuu"

async def get_vendor_company_name(vendor_id: str) -> str:
    """
    Get vendor's business name from their profile.
    This is the per-vendor company name.
    """
    from bson import ObjectId
    try:
        vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
        if vendor and vendor.get("business_name"):
            return vendor["business_name"]
    except Exception as e:
        logger.warning(f"Error fetching vendor business name: {e}")
    return DEFAULT_COMPANY_NAME

@api_router.get("/app-settings")
async def get_app_settings(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get app settings for the authenticated vendor.
    Returns vendor's business_name as the company name.
    """
    company_name = await get_vendor_company_name(vendor_id)
    return {
        "company_name": company_name,
        "default_name": DEFAULT_COMPANY_NAME,
        "vendor_id": vendor_id
    }

@api_router.put("/app-settings/company-name")
async def update_company_name(
    company_name: str = Query(..., min_length=1, max_length=100),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Update vendor's business name.
    This updates the vendor's profile, not a global setting.
    """
    from bson import ObjectId
    
    cleaned_name = company_name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Company name cannot be empty or whitespace only")
    
    if len(cleaned_name) > 100:
        raise HTTPException(status_code=400, detail="Company name must be 100 characters or less")
    
    # Update vendor's business_name in their profile
    result = await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {
            "business_name": cleaned_name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    return {"success": True, "company_name": cleaned_name, "message": "Company name updated successfully"}

@api_router.delete("/app-settings/company-name")
async def reset_company_name(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Reset company name to default (for the authenticated vendor).
    """
    from bson import ObjectId
    
    await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {
            "business_name": DEFAULT_COMPANY_NAME,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"success": True, "company_name": DEFAULT_COMPANY_NAME, "message": "Company name reset to default"}

@api_router.get("/app-settings/logo")
async def get_company_logo(vendor_id: str = Depends(get_current_vendor_id)):
    """Get vendor's company logo URL"""
    from bson import ObjectId
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"logo_url": vendor.get("logo_url")}

@api_router.post("/app-settings/logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Upload and update vendor's company logo.
    Security: validates file extension, MIME type, and enforces 5MB size limit.
    """
    try:
        from bson import ObjectId
        import shutil
        import os
        
        # Security: Validate file extension
        ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
        file_extension = os.path.splitext(file.filename or "")[1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type '{file_extension}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Security: Validate MIME type
        ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}
        if file.content_type and file.content_type not in ALLOWED_MIMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid content type '{file.content_type}'. Allowed: {', '.join(ALLOWED_MIMES)}"
            )
        
        # Security: Enforce 5MB size limit
        MAX_SIZE_BYTES = 5 * 1024 * 1024
        contents = await file.read()
        if len(contents) > MAX_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({len(contents) // 1024 // 1024}MB). Maximum size: 5MB"
            )
        
        # Create uploads directory if not exists
        UPLOAD_DIR = "static/uploads/logos"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        # Generate unique filename (sanitized)
        filename = f"{vendor_id}_{datetime.now().timestamp()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save validated file
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
            
        # URL path to be stored (relative to mount point)
        logo_url = f"/static/uploads/logos/{filename}"
        
        # Update vendor profile
        await db.vendors.update_one(
            {"_id": ObjectId(vendor_id)},
            {"$set": {
                "logo_url": logo_url,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"success": True, "logo_url": logo_url, "message": "Logo uploaded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Logo upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload logo")

@api_router.delete("/app-settings/logo")
async def delete_company_logo(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Remove vendor's company logo.
    """
    from bson import ObjectId
    
    await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {
            "logo_url": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"success": True, "message": "Logo removed successfully"}

@api_router.get("/customers")
async def get_customers(
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Get customer list derived from orders.
    Aggregates order history to show total spent, last order, etc.
    """
    pipeline = [
        {"$match": {"vendor_id": vendor_id}},
        
        # Sort by latest first to get correct "last_order_date"
        {"$sort": {"created_at": -1}},
        
        # Group by customer phone (+ name/address from latest order)
        {"$group": {
            "_id": "$customer_phone",
            "name": {"$first": "$customer_name"},
            "address": {"$first": "$customer_address"},
            "total_orders": {"$sum": 1},
            "total_spent": {"$sum": "$amount"},
            "last_order_date": {"$first": "$created_at"},
            "pending_due": {
                "$sum": {
                    "$cond": [{"$in": ["$payment_status", [PaymentStatus.PENDING, PaymentStatus.CASH_DUE, PaymentStatus.DELIVERED_UNPAID]]}, "$amount", 0]
                }
            }
        }},
    ]

    # Search filter
    if search:
        pipeline.append({
            "$match": {
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"_id": {"$regex": search, "$options": "i"}}
                ]
            }
        })
    
    # Pagination
    pipeline.append({"$sort": {"last_order_date": -1}})
    pipeline.append({"$skip": skip})
    pipeline.append({"$limit": limit})

    customers = await db.orders.aggregate(pipeline).to_list(limit)
    return customers

@api_router.get("/customers/{phone_number}")
async def get_customer_by_phone(
    phone_number: str,
    vendor_id: str = Depends(get_current_vendor_id)  # SECURITY: Vendor ID from JWT only
):
    """
    Get a specific customer by phone number.
    SECURITY: Only returns customer if they belong to this vendor.
    """
    # CRITICAL: Filter by vendor_id AND phone_number
    customer = await db.customers.find_one(
        {"phone_number": phone_number, "vendor_id": vendor_id}, 
        {"_id": 0}
    )
    if not customer:
        # Try with 91 prefix
        customer = await db.customers.find_one(
            {"phone_number": f"91{phone_number}", "vendor_id": vendor_id}, 
            {"_id": 0}
        )
    if not customer:
        # Try without 91 prefix if it starts with 91
        if phone_number.startswith("91") and len(phone_number) > 10:
            customer = await db.customers.find_one(
                {"phone_number": phone_number[2:], "vendor_id": vendor_id}, 
                {"_id": 0}
            )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@api_router.post("/customers")
async def create_customer(
    customer_data: CustomerCreateRequest,
    vendor_id: str = Depends(get_current_vendor_id)  # SECURITY: Vendor ID from JWT only
):
    """
    Create a new customer for the authenticated vendor.
    SECURITY: Auto-assigns vendor_id from JWT - never from request body.
    """
    phone = customer_data.phone_number.strip()
    
    # Check if customer already exists FOR THIS VENDOR
    existing = await db.customers.find_one({"phone_number": phone, "vendor_id": vendor_id})
    if existing:
        # Update existing customer
        await db.customers.update_one(
            {"phone_number": phone, "vendor_id": vendor_id},
            {"$set": {
                "name": customer_data.name,
                "address": customer_data.address,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        updated = await db.customers.find_one({"phone_number": phone, "vendor_id": vendor_id}, {"_id": 0})
        return updated
    
    # Create new customer with vendor_id from JWT (NEVER from request body)
    customer = {
        "phone_number": phone,
        "name": customer_data.name,
        "address": customer_data.address,
        "vendor_id": vendor_id,  # SECURITY: Assigned from JWT token
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customers.insert_one(customer)
    customer.pop("_id", None)
    return customer

@api_router.put("/customers/{phone_number}")
async def update_customer(
    phone_number: str,
    update_data: CustomerUpdateRequest,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Update customer details (name/address).
    Also updates past orders for this customer to keep the derived list in sync.
    """
    # 1. Update customers record
    query = {"phone_number": phone_number, "vendor_id": vendor_id}
    data = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    res = await db.customers.update_one(query, {"$set": data})
    
    # 2. Update all orders for this customer for UI aggregation consistency
    order_update = {}
    if update_data.name: order_update["customer_name"] = update_data.name
    if update_data.address: order_update["customer_address"] = update_data.address
    
    if order_update:
        await db.orders.update_many(
            {"customer_phone": phone_number, "vendor_id": vendor_id},
            {"$set": order_update}
        )
        
    return {"success": True, "message": "Customer updated successfully"}

# ============================================
# WHATSAPP SERVICE INTERNAL ENDPOINTS
# These are called by the WhatsApp service and use vendor_id in request body
# ============================================

@api_router.get("/customers/lookup/{phone_number}")
async def lookup_customer_for_whatsapp(phone_number: str, vendor_id: Optional[str] = None):
    """
    Lookup customer by phone number (for WhatsApp bot).
    If vendor_id is provided, filter by vendor. Otherwise return first match.
    This is a service-to-service endpoint.
    """
    query = {"phone_number": phone_number}
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    customer = await db.customers.find_one(query, {"_id": 0})
    if not customer:
        # Try with 91 prefix
        query["phone_number"] = f"91{phone_number}"
        customer = await db.customers.find_one(query, {"_id": 0})
    if not customer:
        # Try without 91 prefix
        if phone_number.startswith("91") and len(phone_number) > 10:
            query["phone_number"] = phone_number[2:]
            customer = await db.customers.find_one(query, {"_id": 0})
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

class WhatsAppCustomerCreate(BaseModel):
    phone_number: str
    name: str
    address: str
    vendor_id: Optional[str] = None  # Optional for WhatsApp orders

@api_router.post("/customers/whatsapp")
async def create_customer_from_whatsapp(data: WhatsAppCustomerCreate):
    """
    Create/update customer from WhatsApp bot.
    This is a service-to-service endpoint used by the WhatsApp service.
    """
    phone = data.phone_number.strip()
    
    # Build query
    query = {"phone_number": phone}
    if data.vendor_id:
        query["vendor_id"] = data.vendor_id
    
    existing = await db.customers.find_one(query)
    if existing:
        # Update existing customer
        await db.customers.update_one(
            query,
            {"$set": {
                "name": data.name,
                "address": data.address,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        updated = await db.customers.find_one(query, {"_id": 0})
        return updated
    
    # Create new customer
    customer = {
        "phone_number": phone,
        "name": data.name,
        "address": data.address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if data.vendor_id:
        customer["vendor_id"] = data.vendor_id
    
    await db.customers.insert_one(customer)
    customer.pop("_id", None)
    return customer

@api_router.get("/products/prices")
async def get_product_prices():
    """Get current prices for all products"""
    prices = {}
    
    # Get all active price settings
    price_settings = await db.price_settings.find({"is_active": True}, {"_id": 0}).to_list(10)
    
    for setting in price_settings:
        prices[f"{setting['litre_size']}L"] = setting['price_per_can']
    
    # Default prices if not set
    if "20L" not in prices:
        prices["20L"] = 50.0
    if "25L" not in prices:
        prices["25L"] = 65.0
    
    return prices

@api_router.post("/inventory/check")
async def check_inventory(
    request: InventoryCheckRequest,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Check if requested quantity is available in inventory.
    SECURITY: Checks inventory for the authenticated vendor only.
    """
    stock = await get_today_stock(vendor_id)
    
    available = stock['available_stock'] >= request.quantity
    
    return {
        "available": available,
        "requested": request.quantity,
        "available_stock": stock['available_stock'],
        "total_stock": stock['total_stock']
    }

@api_router.post("/orders/create")
async def create_multi_item_order(order_req: MultiItemOrderRequest):
    """
    Create a new order with multiple items (used by WhatsApp bot).
    vendor_id should be passed in the request body from WhatsApp service.
    """
    try:
        phone_number = order_req.customer_phone
        vendor_id = order_req.vendor_id  # Get vendor_id from request
        
        logger.info(f"Creating multi-item order for vendor: {vendor_id}, customer: {phone_number}")
        
        # Use provided delivery date or default to today
        if order_req.delivery_date:
            delivery_date = order_req.delivery_date
        else:
            delivery_date = date.today().isoformat()
        
        # Calculate total quantity and amount
        total_quantity = sum(item.quantity for item in order_req.items)
        total_amount = sum(item.quantity * item.price_per_can for item in order_req.items)
        
        # Check stock only for today's orders (filtered by vendor)
        if not order_req.is_tomorrow_order:
            stock = await get_today_stock(vendor_id)
            if stock['available_stock'] < total_quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient stock. Available: {stock['available_stock']}, Requested: {total_quantity}"
                )
        
        # Get or create stock for tomorrow if needed (with vendor_id)
        if order_req.is_tomorrow_order:
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            stock_query = {"date": tomorrow}
            if vendor_id:
                stock_query["vendor_id"] = vendor_id
            tomorrow_stock = await db.stock.find_one(stock_query)
            if not tomorrow_stock:
                # Create tomorrow's stock with default values
                stock_doc = {
                    "date": tomorrow,
                    "total_stock": 50,
                    "available_stock": 50,
                    "orders_count": 0,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                if vendor_id:
                    stock_doc["vendor_id"] = vendor_id
                await db.stock.insert_one(stock_doc)
        
        # Assign delivery staff (filtered by vendor)
        staff, shift = await get_active_delivery_staff_for_shift(vendor_id)
        if not staff and not order_req.is_tomorrow_order:
            # For tomorrow's orders, we'll assign staff later
            raise HTTPException(status_code=400, detail="No delivery staff available for this shift.")
        
        # Create individual orders for each item size
        created_orders = []
        
        for item in order_req.items:
            if item.quantity <= 0:
                continue
                
            item_amount = item.quantity * item.price_per_can
            order_id = f"ORD{datetime.now().strftime('%Y%m%d%H%M%S%f')[:17]}"
            
            order_data = {
                "order_id": order_id,
                "customer_phone": phone_number,
                "customer_name": order_req.customer_name,
                "customer_address": order_req.customer_address,
                "litre_size": item.litre_size,
                "quantity": item.quantity,
                "price_per_can": item.price_per_can,
                "status": "pending",
                "delivery_staff_id": staff['staff_id'] if staff else None,
                "delivery_staff_name": staff['name'] if staff else "To be assigned",
                "vendor_id": vendor_id,  # CRITICAL: Assign vendor_id
                "payment_status": "pending",
                "payment_method": None,
                "amount": item_amount,
                "shift_assigned": shift,
                "delivery_date": delivery_date,
                "is_tomorrow_order": order_req.is_tomorrow_order,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "delivered_at": None,
                "notification_status": "queued",
                "notification_attempts": 0,
                "last_notification_error": None
            }
            
            await db.orders.insert_one(order_data)
            created_orders.append(order_id)
            logger.info(f"Created order {order_id} for vendor {vendor_id}")
            
            # Update stock (filtered by vendor)
            if not order_req.is_tomorrow_order:
                stock_query = {"date": date.today().isoformat()}
                if vendor_id:
                    stock_query["vendor_id"] = vendor_id
                await db.stock.update_one(
                    stock_query,
                    {
                        "$inc": {"available_stock": -item.quantity, "orders_count": 1},
                        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
            else:
                # Update tomorrow's stock
                tomorrow = (date.today() + timedelta(days=1)).isoformat()
                stock_query = {"date": tomorrow}
                if vendor_id:
                    stock_query["vendor_id"] = vendor_id
                await db.stock.update_one(
                    stock_query,
                    {
                        "$inc": {"available_stock": -item.quantity, "orders_count": 1},
                        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
            
            # Update staff order count
            if staff:
                await db.delivery_staff.update_one(
                    {"staff_id": staff['staff_id'], "vendor_id": vendor_id} if vendor_id else {"staff_id": staff['staff_id']},
                    {"$inc": {"active_orders_count": 1}}
                )
            
            # Add to notification queue (only for today's orders)
            if not order_req.is_tomorrow_order and staff:
                await add_to_notification_queue(order_id)
        
        # Return combined response
        return {
            "success": True,
            "order_id": created_orders[0] if len(created_orders) == 1 else ", ".join(created_orders),
            "total_amount": total_amount,
            "delivery_staff": staff['name'] if staff else "To be assigned",
            "shift": shift,
            "delivery_date": delivery_date,
            "is_tomorrow_order": order_req.is_tomorrow_order,
            "notification_status": "queued" if not order_req.is_tomorrow_order else "scheduled"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating multi-item order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/whatsapp/delivery-response")
async def handle_delivery_response(
    phone_number: str = Query(...), 
    message: str = Query(...),
    api_key: str = Depends(verify_service_api_key)
):
    """Handle delivery staff responses from WhatsApp"""
    try:
        # Find delivery staff by phone
        staff = await db.delivery_staff.find_one({
            "$or": [
                {"phone_number": phone_number},
                {"phone_number": f"91{phone_number}"},
                {"phone_number": phone_number[2:] if phone_number.startswith("91") else phone_number}
            ]
        })
        
        if not staff:
            return {"success": False, "message": "Delivery staff not found"}
        
        # Process message (reuse existing logic)
        await handle_delivery_boy_message(phone_number, message.lower(), staff)
        
        return {"success": True}
    except Exception as e:
        logging.error(f"Error handling delivery response: {e}")
        return {"success": False, "message": str(e)}



@api_router.get("/customers")
async def get_customers(
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Get customers derived from order history.
    """
    try:
        match_stage = {"vendor_id": vendor_id}
        if search:
            match_stage["$or"] = [
                {"customer_name": {"$regex": search, "$options": "i"}},
                {"customer_phone": {"$regex": search, "$options": "i"}}
            ]

        pipeline = [
            {"$match": match_stage},
            {"$group": {
                "_id": "$customer_phone",
                "name": {"$first": "$customer_name"},
                "address": {"$first": "$customer_address"},
                "total_orders": {"$sum": 1},
                "last_order": {"$max": "$created_at"},
                "total_spent": {"$sum": "$amount"},
                "pending_due": {"$sum": "$amount_due"}
            }},
            {"$sort": {"last_order": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        customers = await db.orders.aggregate(pipeline).to_list(limit)
        return customers
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/export/orders")
async def export_orders(
    date_filter: Optional[str] = None, 
    format: str = Query("json"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Export orders data in JSON or CSV format.
    SECURITY: Only exports orders belonging to the authenticated vendor.
    """
    query = {"vendor_id": vendor_id}  # CRITICAL: Filter by vendor
    if date_filter:
        query['created_at'] = {"$regex": f"^{date_filter}"}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    if format == "csv":
        import csv
        from io import StringIO
        
        if not orders:
            return {"data": "", "format": "csv"}
        
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=orders[0].keys())
        writer.writeheader()
        writer.writerows(orders)
        
        return {"data": output.getvalue(), "format": "csv", "count": len(orders)}
    
    return {"data": orders, "format": "json", "count": len(orders)}

@api_router.get("/export/customers")
async def export_customers(
    format: str = Query("json"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Export customers data in JSON or CSV format.
    SECURITY: Only exports customers belonging to the authenticated vendor.
    """
    customers = await db.customers.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(10000)
    
    if format == "csv":
        import csv
        from io import StringIO
        
        if not customers:
            return {"data": "", "format": "csv"}
        
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=customers[0].keys())
        writer.writeheader()
        writer.writerows(customers)
        
        return {"data": output.getvalue(), "format": "csv", "count": len(customers)}
    
    return {"data": customers, "format": "json", "count": len(customers)}

@api_router.get("/export/stock")
async def export_stock(
    format: str = Query("json"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Export stock history data in JSON or CSV format.
    SECURITY: Only exports stock for the authenticated vendor.
    """
    stock_data = await db.stock.find({"vendor_id": vendor_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    
    if format == "csv":
        import csv
        from io import StringIO
        
        if not stock_data:
            return {"data": "", "format": "csv"}
        
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=stock_data[0].keys())
        writer.writeheader()
        writer.writerows(stock_data)
        
        return {"data": output.getvalue(), "format": "csv", "count": len(stock_data)}
    
    return {"data": stock_data, "format": "json", "count": len(stock_data)}

@api_router.get("/whatsapp/qr")
async def get_qr_code(vendor_id: str = Depends(get_current_vendor_id)):
    """Get QR code for connecting vendor's WhatsApp (per-vendor)"""
    try:
        async with httpx.AsyncClient() as client:
            # Call vendor-specific endpoint
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/qr/{vendor_id}", timeout=5.0)
            return response.json()
    except Exception as e:
        return {"qr": None, "error": str(e)}

@api_router.get("/whatsapp/status")
async def get_whatsapp_status(vendor_id: str = Depends(get_current_vendor_id)):
    """Check WhatsApp connection status (per-vendor)"""
    try:
        # Check Baileys service for this specific vendor
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status/{vendor_id}", timeout=5.0)
            baileys_status = response.json()
            
            if baileys_status.get('connected'):
                return {
                    "connected": True,
                    "method": "baileys",
                    "user": baileys_status.get('user')
                }
        
        # Check Cloud API if configured (fallback - shared)
        if whatsapp_api.phone_number_id and whatsapp_api.access_token:
            return {
                "connected": True,
                "method": "cloud_api",
                "phone_number_id": whatsapp_api.phone_number_id
            }
        
        return {"connected": False, "method": None}
    except Exception as e:
        return {"connected": False, "error": str(e)}

@api_router.post("/whatsapp/disconnect")
async def disconnect_whatsapp(vendor_id: str = Depends(get_current_vendor_id)):
    """Disconnect WhatsApp for this vendor"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/disconnect/{vendor_id}", timeout=10.0)
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect WhatsApp: {str(e)}")

@api_router.post("/whatsapp/reconnect")
async def reconnect_whatsapp(vendor_id: str = Depends(get_current_vendor_id)):
    """Reconnect WhatsApp for this vendor"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/reconnect/{vendor_id}", timeout=10.0)
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reconnect WhatsApp: {str(e)}")

@api_router.post("/whatsapp/send-test")
async def send_test_message(
    phone: str, 
    message: str = "Hello from HydroFlow! This is a test message.",
    vendor_id: str = Depends(get_current_vendor_id)
):
    """Manually send a test message from this vendor's WhatsApp"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send/{vendor_id}",
                json={"to": phone, "message": message},
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test message: {str(e)}")

@api_router.get("/price-settings")
async def get_price_settings(vendor_id: str = Depends(get_current_vendor_id)):
    """
    Get price settings for the authenticated vendor.
    Falls back to global defaults if vendor has no custom prices.
    """
    settings = await db.price_settings.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(100)
    
    # If no vendor-specific prices, return defaults
    if not settings:
        return [
            {"litre_size": 20, "price_per_can": 50.0, "is_active": True},
            {"litre_size": 25, "price_per_can": 65.0, "is_active": True}
        ]
    return settings

@api_router.post("/price-settings")
async def create_or_update_price_setting(
    setting: PriceSetting,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Create or update price setting for the authenticated vendor.
    """
    setting_dict = setting.model_dump()
    setting_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    setting_dict['vendor_id'] = vendor_id  # Assign vendor ownership
    
    await db.price_settings.update_one(
        {"litre_size": setting.litre_size, "vendor_id": vendor_id},
        {"$set": setting_dict},
        upsert=True
    )
    
    return {"success": True, "message": "Price setting updated"}

@api_router.get("/delivery-shifts")
async def get_delivery_shifts(
    date_param: Optional[str] = Query(None),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Get delivery shifts for the authenticated vendor.
    """
    if not date_param:
        date_param = date.today().isoformat()
    
    shifts = await db.delivery_shifts.find(
        {"date": date_param, "vendor_id": vendor_id}, 
        {"_id": 0}
    ).to_list(100)
    return shifts

@api_router.post("/delivery-shifts")
async def create_or_update_shift(
    shift: DeliveryShift,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Create or update delivery shift for the authenticated vendor.
    """
    shift_dict = shift.model_dump()
    shift_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    shift_dict['vendor_id'] = vendor_id  # Assign vendor ownership
    
    await db.delivery_shifts.update_one(
        {"date": shift.date, "staff_id": shift.staff_id, "vendor_id": vendor_id},
        {"$set": shift_dict},
        upsert=True
    )
    
    return {"success": True, "message": "Shift updated"}

@api_router.delete("/delivery-shifts/{staff_id}/{date}/{shift}")
async def delete_delivery_shift(
    staff_id: str, 
    date: str, 
    shift: str,
    vendor_id: str = Depends(get_current_vendor_id)
):
    """
    Delete delivery shift for the authenticated vendor.
    """
    result = await db.delivery_shifts.delete_one({
        "staff_id": staff_id,
        "date": date,
        "shift": shift,
        "vendor_id": vendor_id  # Only delete own shifts
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Delivery shift not found")
    return {"message": "Delivery shift deleted successfully"}

@api_router.post("/seed")
async def seed_database():
    """Seed database with sample data for demo purposes"""
    try:
        import subprocess
        import sys
        
        # Run the seed_data.py script
        result = subprocess.run(
            [sys.executable, "seed_data.py"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Database seeded successfully",
                "output": result.stdout
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Seeding failed: {result.stderr}"
            )
    except Exception as e:
        logging.error(f"Error seeding database: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoints
@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "service": "HydroFlow Backend API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        await db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Configure CORS middleware BEFORE including router
# Include Capacitor origins for Android native app
_cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
_capacitor_origins = ['https://localhost', 'capacitor://localhost', 'http://localhost']
_all_origins = list(set(_cors_origins + _capacitor_origins))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# VENDOR: Agent Damage Reports (photos + agent name)
# ============================================

@api_router.get("/damage-reports")
async def get_damage_reports(
    days: int = Query(default=7, ge=1, le=90, description="Number of days"),
    vendor_id: str = Depends(get_current_vendor_id)
):
    """Get damage reports submitted by agents for this vendor."""
    ist_offset = timedelta(hours=5, minutes=30)
    cutoff = (datetime.now(timezone.utc) + ist_offset - timedelta(days=days))
    cutoff_str = cutoff.isoformat()

    reports = await db.damage_reports.find({
        "vendor_id": vendor_id,
        "created_at": {"$gte": cutoff_str}
    }).sort("created_at", -1).to_list(200)

    formatted = []
    for r in reports:
        r.pop("_id", None)
        formatted.append({
            "report_id": r.get("report_id", ""),
            "agent_id": r.get("agent_id", ""),
            "agent_name": r.get("agent_name", "Unknown"),
            "order_id": r.get("order_id"),
            "damaged_qty": r.get("damaged_qty", 0),
            "returned_qty": r.get("returned_qty", 0),
            "reason": r.get("reason", "other"),
            "notes": r.get("notes"),
            "litre_size": r.get("litre_size", 20),
            "photo_url": r.get("photo_url"),
            "created_at": r.get("created_at", "")
        })

    return {
        "reports": formatted,
        "total": len(formatted),
        "period_days": days
    }

# Include API router
app.include_router(api_router)

# Include Auth router
from routers.auth import router as auth_router, set_database, get_current_vendor_id
set_database(db)
app.include_router(auth_router, prefix="/api")

# Include Agent router
from routers.agent import router as agent_router, set_database as set_agent_db
set_agent_db(db)
app.include_router(agent_router, prefix="/api")
