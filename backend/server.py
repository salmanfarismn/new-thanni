from fastapi import FastAPI, APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
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

# Configure logging at module level
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up HydroFlow backend...")
    logger.info(f"Connected to MongoDB: {os.environ['DB_NAME']}")
    yield
    # Shutdown
    logger.info("Shutting down HydroFlow backend...")
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

WHATSAPP_SERVICE_URL = os.environ.get('WHATSAPP_SERVICE_URL', 'http://localhost:3001')

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
    active_orders_count: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    payment_status: str
    payment_method: Optional[str] = None
    amount: float
    shift_assigned: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    delivered_at: Optional[datetime] = None
    # Notification queue fields
    notification_status: str = "queued"  # queued, sending, sent, failed
    notification_attempts: int = 0
    last_notification_error: Optional[str] = None

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

# New: Customer creation request
class CustomerCreateRequest(BaseModel):
    phone_number: str
    name: str
    address: str

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

async def get_company_name() -> str:
    """Get company name from settings or return default"""
    try:
        settings = await db.settings.find_one({"key": "company_name"})
        if settings and settings.get("value"):
            return settings["value"]
    except Exception as e:
        logger.warning(f"Error fetching company name: {e}")
    return "Thanni Canuuu"

async def send_order_notification(order_id: str):
    """Send WhatsApp notification for a specific order"""
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
        # Get delivery staff
        staff = await db.delivery_staff.find_one({"staff_id": order.get('delivery_staff_id')})
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
        
        # Get company name for branding
        company_name = await get_company_name()
        
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
        
        # Send message to delivery boy
        result = await send_whatsapp_message(staff['phone_number'], message)
        
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

async def send_whatsapp_message(phone_number: str, message: str):
    """Send WhatsApp message using available method (Cloud API or Baileys)"""
    try:
        # Normalize phone number to include country code
        normalized_phone = normalize_phone_number(phone_number)
        logger.info(f"Sending WhatsApp message to {normalized_phone}")
        
        # Try Cloud API first if configured
        if whatsapp_api.phone_number_id and whatsapp_api.access_token:
            result = await whatsapp_api.send_text_message(normalized_phone, message)
            if result.get('success'):
                return result
        
        # Fallback to Baileys service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send",
                json={"phone_number": normalized_phone, "message": message},
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

async def get_active_delivery_staff_for_shift():
    """Get delivery staff active for current time shift"""
    current_hour = datetime.now(timezone.utc).hour
    
    if 6 <= current_hour < 14:
        shift = "morning"
    else:
        shift = "evening"
    
    today = date.today().isoformat()
    
    active_shifts = await db.delivery_shifts.find({
        "date": today,
        "is_active": True,
        "$or": [
            {"shift": shift},
            {"shift": "full_day"}
        ]
    }).to_list(100)
    
    if not active_shifts:
        return None, None
    
    staff_ids = [s['staff_id'] for s in active_shifts]
    
    staff = await db.delivery_staff.find({
        "staff_id": {"$in": staff_ids},
        "is_active": True
    }).sort("active_orders_count", 1).limit(1).to_list(1)
    
    if staff:
        return staff[0], shift
    return None, None

async def get_price_for_litre(litre_size: int):
    """Get current price for a litre size"""
    price_setting = await db.price_settings.find_one({
        "litre_size": litre_size,
        "is_active": True
    })
    
    if price_setting:
        return price_setting['price_per_can']
    
    return 50.0

async def get_today_stock():
    today = date.today().isoformat()
    stock = await db.stock.find_one({"date": today}, {"_id": 0})
    if not stock:
        stock = {
            "date": today,
            "total_stock": 50,
            "available_stock": 50,
            "orders_count": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.stock.insert_one(stock)
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
async def get_dashboard_metrics():
    today = date.today().isoformat()
    
    stock = await get_today_stock()
    
    # Get all orders instead of just today's
    orders = await db.orders.find({}).to_list(10000)
    
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
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """
    Get sales metrics for a date range.
    If no dates provided, defaults to today.
    """
    try:
        # Default to today if no dates provided
        if not start_date:
            start_date = date.today().isoformat()
        if not end_date:
            end_date = date.today().isoformat()
        
        # Validate date format
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Build date range query
        # created_at is stored as ISO string in UTC
        # Adjust for IST (UTC+5:30) - IST midnight = UTC 18:30 previous day
        # So for IST date, we need to query from previous day 18:30 UTC to current day 18:29 UTC
        
        # Parse the dates
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Convert IST dates to UTC range
        # IST is UTC+5:30, so IST midnight = previous day 18:30 UTC
        from datetime import time as dt_time
        start_utc = datetime.combine(start_dt.date() - timedelta(days=1), dt_time(18, 30, 0))
        end_utc = datetime.combine(end_dt.date(), dt_time(18, 29, 59))
        
        query = {
            "created_at": {
                "$gte": start_utc.isoformat(),
                "$lte": end_utc.isoformat()
            }
        }
        
        orders = await db.orders.find(query).to_list(10000)
        
        # Calculate metrics
        total_orders = len(orders)
        total_cans_sold = sum(o.get('quantity', 0) for o in orders)
        
        # Revenue from paid orders
        paid_orders = [o for o in orders if o.get('payment_status') == 'paid']
        total_revenue = sum(o.get('amount', 0) for o in paid_orders)
        
        # All orders revenue (including pending)
        total_order_value = sum(o.get('amount', 0) for o in orders)
        
        # Breakdown by status
        delivered_orders = len([o for o in orders if o.get('status') == 'delivered'])
        pending_orders = len([o for o in orders if o.get('status') == 'pending'])
        
        # Payment breakdown
        paid_count = len(paid_orders)
        pending_payment_orders = [o for o in orders if o.get('payment_status') == 'pending']
        pending_payment_count = len(pending_payment_orders)
        pending_payment_amount = sum(o.get('amount', 0) for o in pending_payment_orders)
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_orders": total_orders,
            "total_cans_sold": total_cans_sold,
            "total_revenue": total_revenue,
            "total_order_value": total_order_value,
            "delivered_orders": delivered_orders,
            "pending_orders": pending_orders,
            "paid_orders": paid_count,
            "pending_payment_orders": pending_payment_count,
            "pending_payment_amount": pending_payment_amount
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sales data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/orders")
async def get_orders(
    status: Optional[str] = None, 
    staff_id: Optional[str] = None, 
    date_filter: Optional[str] = None,
    delivery_date: Optional[str] = None,
    include_tomorrow: bool = False
):
    """Get orders with optional filters. Tomorrow's orders are prioritized first."""
    query = {}
    if status:
        query['status'] = status
    if staff_id:
        query['delivery_staff_id'] = staff_id
    if date_filter:
        query['created_at'] = {"$regex": f"^{date_filter}"}
    if delivery_date:
        query['delivery_date'] = delivery_date
    
    # Get orders
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
async def get_tomorrow_orders():
    """Get all orders scheduled for tomorrow - these appear first in delivery assignment"""
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    
    orders = await db.orders.find(
        {"$or": [
            {"delivery_date": tomorrow},
            {"is_tomorrow_order": True, "status": "pending"}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)  # Sort by created_at ascending so first orders come first
    
    return {
        "date": tomorrow,
        "count": len(orders),
        "orders": orders
    }

@api_router.get("/orders/delivery-queue")
async def get_delivery_queue(staff_id: Optional[str] = None):
    """Get delivery queue with tomorrow's orders first, then today's orders"""
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    
    query = {"status": "pending"}
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
async def create_order_directly(order_req: OrderCreateRequest):
    """Create an order directly (used by WhatsApp service)"""
    try:
        phone_number = order_req.customer_phone
        quantity = order_req.quantity
        litre_size = order_req.litre_size
        
        # 1. Check stock
        stock = await get_today_stock()
        if stock['available_stock'] < quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {stock['available_stock']}")

        # 2. Get price
        price_per_can = await get_price_for_litre(litre_size)
        total_amount = quantity * price_per_can

        # 3. Assign delivery staff
        staff, shift = await get_active_delivery_staff_for_shift()
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

        # 5. Update stock
        await db.stock.update_one(
            {"date": stock['date']},
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
async def get_order(order_id: str):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.post("/orders/{order_id}/retry-notification")
async def retry_order_notification(order_id: str):
    """Retry sending notification for a failed order"""
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get('notification_status') == 'sent':
        return {"success": False, "message": "Notification already sent"}
    
    # Reset status and add to queue
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"notification_status": "queued"}}
    )
    
    await add_to_notification_queue(order_id)
    
    return {"success": True, "message": "Order added to notification queue for retry"}

@api_router.get("/orders/queue/status")
async def get_notification_queue_status():
    """Get current notification queue status"""
    # Count orders by notification status
    pipeline = [
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
async def update_order_status(order_id: str, update: DeliveryUpdate):
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {"status": update.status}
    if update.status == 'delivered':
        update_data['delivered_at'] = datetime.now(timezone.utc).isoformat()
        
        if order['status'] == 'pending':
            await db.delivery_staff.update_one(
                {"staff_id": order['delivery_staff_id']},
                {"$inc": {"active_orders_count": -1}}
            )
    
    if update.payment_status:
        update_data['payment_status'] = update.payment_status
    if update.payment_method:
        update_data['payment_method'] = update.payment_method
    
    await db.orders.update_one({"order_id": order_id}, {"$set": update_data})
    
    updated_order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return updated_order

@api_router.get("/stock")
async def get_stock(date_param: Optional[str] = Query(None)):
    if date_param:
        stock = await db.stock.find_one({"date": date_param}, {"_id": 0})
    else:
        stock = await get_today_stock()
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock data not found")
    return stock

@api_router.put("/stock")
async def update_stock(stock_update: StockUpdateRequest):
    today = date.today().isoformat()
    # Always fetch current stock first for calculations
    stock = await get_today_stock()
    if stock_update.increment is not None:
        # Increment both total and available stock
        await db.stock.update_one(
            {"date": today},
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
            {"date": today},
            {
                "$set": {
                    "total_stock": stock_update.total_stock,
                    "available_stock": max(0, new_available),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    updated_stock = await db.stock.find_one({"date": today}, {"_id": 0})
    return updated_stock

@api_router.get("/delivery-staff")
async def get_delivery_staff():
    staff = await db.delivery_staff.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return staff

@api_router.post("/delivery-staff")
async def create_delivery_staff(staff: DeliveryStaff):
    """Create a new delivery staff member with validation"""
    # Validate phone number format (at least 10 digits)
    phone = staff.phone_number.strip()
    if not phone or len(phone) < 10 or not phone.replace('+', '').replace('-', '').replace(' ', '').isdigit():
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be at least 10 digits.")
    
    # Check for duplicate phone number
    existing = await db.delivery_staff.find_one({"phone_number": phone})
    if existing:
        raise HTTPException(status_code=400, detail="Delivery staff with this phone number already exists")
    
    staff_dict = staff.model_dump()
    staff_dict['phone_number'] = phone
    staff_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.delivery_staff.insert_one(staff_dict)
    # Remove MongoDB _id to avoid serialization error
    staff_dict.pop('_id', None)
    return {"success": True, "message": "Delivery staff added successfully", "staff": staff_dict}

@api_router.put("/delivery-staff/{staff_id}")
async def update_delivery_staff_status(staff_id: str, is_active: bool = Query(...)):
    """Toggle delivery staff active status"""
    result = await db.delivery_staff.update_one(
        {"staff_id": staff_id},
        {"$set": {"is_active": is_active}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Delivery staff not found")
    
    status = "activated" if is_active else "deactivated"
    return {"success": True, "message": f"Delivery staff {status} successfully"}

@api_router.delete("/delivery-staff/{staff_id}")
async def delete_delivery_staff(staff_id: str):
    """Delete a delivery staff member"""
    # Check for pending orders assigned to this staff
    pending_orders = await db.orders.count_documents({
        "delivery_staff_id": staff_id,
        "status": "pending"
    })
    
    if pending_orders > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete: {pending_orders} pending order(s) assigned to this staff member"
        )
    
    result = await db.delivery_staff.delete_one({"staff_id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Delivery staff not found")
    
    # Also delete any future shifts for this staff
    await db.delivery_shifts.delete_many({"staff_id": staff_id})
    
    return {"success": True, "message": "Delivery staff deleted successfully"}

# ============================================
# APP SETTINGS (Company Name Customization)
# ============================================
DEFAULT_COMPANY_NAME = "Thanni Canuuu"

async def get_company_name():
    """Get current company name or default"""
    settings = await db.app_settings.find_one({"key": "company_name"})
    if settings and settings.get('value'):
        return settings['value']
    return DEFAULT_COMPANY_NAME

@api_router.get("/app-settings")
async def get_app_settings():
    """Get all app settings"""
    company_name = await get_company_name()
    return {
        "company_name": company_name,
        "default_name": DEFAULT_COMPANY_NAME
    }

@api_router.put("/app-settings/company-name")
async def update_company_name(company_name: str = Query(..., min_length=1, max_length=100)):
    """Update company/shop name"""
    # Validate - prevent whitespace-only names
    cleaned_name = company_name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Company name cannot be empty or whitespace only")
    
    if len(cleaned_name) > 100:
        raise HTTPException(status_code=400, detail="Company name must be 100 characters or less")
    
    await db.app_settings.update_one(
        {"key": "company_name"},
        {
            "$set": {
                "key": "company_name",
                "value": cleaned_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"success": True, "company_name": cleaned_name, "message": "Company name updated successfully"}

@api_router.delete("/app-settings/company-name")
async def reset_company_name():
    """Reset company name to default"""
    await db.app_settings.delete_one({"key": "company_name"})
    return {"success": True, "company_name": DEFAULT_COMPANY_NAME, "message": "Company name reset to default"}

@api_router.get("/customers")
async def get_customers(limit: Optional[int] = Query(100)):
    """Get all customers"""
    customers = await db.customers.find({}, {"_id": 0}).limit(limit).to_list(limit)
    return customers

@api_router.get("/customers/{phone_number}")
async def get_customer_by_phone(phone_number: str):
    """Get a specific customer by phone number"""
    # Try with and without country code
    customer = await db.customers.find_one({"phone_number": phone_number}, {"_id": 0})
    if not customer:
        # Try with 91 prefix
        customer = await db.customers.find_one({"phone_number": f"91{phone_number}"}, {"_id": 0})
    if not customer:
        # Try without 91 prefix if it starts with 91
        if phone_number.startswith("91") and len(phone_number) > 10:
            customer = await db.customers.find_one({"phone_number": phone_number[2:]}, {"_id": 0})
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@api_router.post("/customers")
async def create_customer(customer_data: CustomerCreateRequest):
    """Create a new customer"""
    phone = customer_data.phone_number.strip()
    
    # Check if customer already exists
    existing = await db.customers.find_one({"phone_number": phone})
    if existing:
        # Update existing customer
        await db.customers.update_one(
            {"phone_number": phone},
            {"$set": {
                "name": customer_data.name,
                "address": customer_data.address,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        updated = await db.customers.find_one({"phone_number": phone}, {"_id": 0})
        return updated
    
    # Create new customer
    customer = {
        "phone_number": phone,
        "name": customer_data.name,
        "address": customer_data.address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
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
async def check_inventory(request: InventoryCheckRequest):
    """Check if requested quantity is available in inventory"""
    stock = await get_today_stock()
    
    available = stock['available_stock'] >= request.quantity
    
    return {
        "available": available,
        "requested": request.quantity,
        "available_stock": stock['available_stock'],
        "total_stock": stock['total_stock']
    }

@api_router.post("/orders/create")
async def create_multi_item_order(order_req: MultiItemOrderRequest):
    """Create a new order with multiple items (used by WhatsApp bot)"""
    try:
        phone_number = order_req.customer_phone
        
        # Use provided delivery date or default to today
        if order_req.delivery_date:
            delivery_date = order_req.delivery_date
        else:
            delivery_date = date.today().isoformat()
        
        # Calculate total quantity and amount
        total_quantity = sum(item.quantity for item in order_req.items)
        total_amount = sum(item.quantity * item.price_per_can for item in order_req.items)
        
        # Check stock only for today's orders
        if not order_req.is_tomorrow_order:
            stock = await get_today_stock()
            if stock['available_stock'] < total_quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient stock. Available: {stock['available_stock']}, Requested: {total_quantity}"
                )
        
        # Get or create stock for tomorrow if needed
        if order_req.is_tomorrow_order:
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            tomorrow_stock = await db.stock.find_one({"date": tomorrow})
            if not tomorrow_stock:
                # Create tomorrow's stock with default values
                await db.stock.insert_one({
                    "date": tomorrow,
                    "total_stock": 50,
                    "available_stock": 50,
                    "orders_count": 0,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })
        
        # Assign delivery staff (prefer staff assigned for that date's shift)
        staff, shift = await get_active_delivery_staff_for_shift()
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
            
            # Update stock
            if not order_req.is_tomorrow_order:
                await db.stock.update_one(
                    {"date": date.today().isoformat()},
                    {
                        "$inc": {"available_stock": -item.quantity, "orders_count": 1},
                        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
            else:
                # Update tomorrow's stock
                tomorrow = (date.today() + timedelta(days=1)).isoformat()
                await db.stock.update_one(
                    {"date": tomorrow},
                    {
                        "$inc": {"available_stock": -item.quantity, "orders_count": 1},
                        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
            
            # Update staff order count
            if staff:
                await db.delivery_staff.update_one(
                    {"staff_id": staff['staff_id']},
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
async def handle_delivery_response(phone_number: str = Query(...), message: str = Query(...)):
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



@api_router.get("/export/orders")
async def export_orders(date_filter: Optional[str] = None, format: str = Query("json")):
    """Export orders data in JSON or CSV format"""
    query = {}
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
async def export_customers(format: str = Query("json")):
    """Export customers data in JSON or CSV format"""
    customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
    
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
async def export_stock(format: str = Query("json")):
    """Export stock history data in JSON or CSV format"""
    stock_data = await db.stock.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    
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
async def get_qr_code():
    """Get QR code for connecting owner's WhatsApp"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/qr", timeout=5.0)
            return response.json()
    except Exception as e:
        return {"qr": None, "error": str(e)}

@api_router.get("/whatsapp/status")
async def get_whatsapp_status():
    """Check WhatsApp connection status"""
    try:
        # Check Baileys service first
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status", timeout=5.0)
            baileys_status = response.json()
            
            if baileys_status.get('connected'):
                return {
                    "connected": True,
                    "method": "baileys",
                    "user": baileys_status.get('user')
                }
        
        # Check Cloud API if configured
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
async def disconnect_whatsapp():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/disconnect", timeout=10.0)
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect WhatsApp: {str(e)}")

@api_router.post("/whatsapp/reconnect")
async def reconnect_whatsapp():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/reconnect", timeout=10.0)
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reconnect WhatsApp: {str(e)}")

@api_router.post("/whatsapp/send-test")
async def send_test_message(phone: str, message: str = "Hello from HydroFlow! This is a test message."):
    """Manually send a test message"""
    try:
        result = await send_whatsapp_message(phone, message)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test message: {str(e)}")

@api_router.get("/price-settings")
async def get_price_settings():
    settings = await db.price_settings.find({}, {"_id": 0}).to_list(100)
    return settings

@api_router.post("/price-settings")
async def create_or_update_price_setting(setting: PriceSetting):
    setting_dict = setting.model_dump()
    setting_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.price_settings.update_one(
        {"litre_size": setting.litre_size},
        {"$set": setting_dict},
        upsert=True
    )
    
    return {"success": True, "message": "Price setting updated"}

@api_router.get("/delivery-shifts")
async def get_delivery_shifts(date_param: Optional[str] = Query(None)):
    if not date_param:
        date_param = date.today().isoformat()
    
    shifts = await db.delivery_shifts.find({"date": date_param}, {"_id": 0}).to_list(100)
    return shifts

@api_router.post("/delivery-shifts")
async def create_or_update_shift(shift: DeliveryShift):
    shift_dict = shift.model_dump()
    shift_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.delivery_shifts.update_one(
        {"date": shift.date, "staff_id": shift.staff_id},
        {"$set": shift_dict},
        upsert=True
    )
    
    return {"success": True, "message": "Shift updated"}

@api_router.delete("/delivery-shifts/{staff_id}/{date}/{shift}")
async def delete_delivery_shift(staff_id: str, date: str, shift: str):
    result = await db.delivery_shifts.delete_one({
        "staff_id": staff_id,
        "date": date,
        "shift": shift
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
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router)

