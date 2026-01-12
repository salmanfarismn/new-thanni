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
from datetime import datetime, timezone, date
import httpx
from whatsapp_cloud_api import whatsapp_api

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
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

class StockUpdateRequest(BaseModel):
    total_stock: int

class DeliveryUpdate(BaseModel):
    order_id: str
    status: str
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None

async def send_whatsapp_message(phone_number: str, message: str):
    """Send WhatsApp message using available method (Cloud API or Baileys)"""
    try:
        # Try Cloud API first if configured
        if whatsapp_api.phone_number_id and whatsapp_api.access_token:
            result = await whatsapp_api.send_text_message(phone_number, message)
            if result.get('success'):
                return result
        
        # Fallback to Baileys service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send",
                json={"phone_number": phone_number, "message": message},
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        logging.error(f"Failed to send WhatsApp message: {e}")
        return {"success": False, "error": str(e)}

async def send_whatsapp_buttons(phone_number: str, body_text: str, buttons: list, header: str = None):
    """Send WhatsApp buttons using available method"""
    try:
        # Try Cloud API first if configured
        if whatsapp_api.phone_number_id and whatsapp_api.access_token:
            result = await whatsapp_api.send_interactive_buttons(phone_number, body_text, buttons, header=header)
            if result.get('success'):
                return result
        
        # Fallback to Baileys with text format
        button_text = body_text + "\n\n"
        for i, btn in enumerate(buttons, 1):
            button_text += f"{i}. {btn['title']}\n"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send",
                json={"phone_number": phone_number, "message": button_text},
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
        "staff_id": {"$in": staff_ids}
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
        
        # Handle "Delivered" button
        if 'delivered' in message_text or message_text == 'delivered_btn':
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
                
                # Ask for payment status
                await send_whatsapp_buttons(
                    phone_number,
                    f"✅ Order {order['order_id']} marked as DELIVERED!\n\nAmount to collect: ₹{order['amount']}\n\nPayment received?",
                    [
                        {"id": "paid_cash", "title": "💵 Paid - Cash"},
                        {"id": "paid_upi", "title": "📱 Paid - UPI"},
                        {"id": "not_paid", "title": "⏳ Not Paid"}
                    ]
                )
            else:
                await send_whatsapp_message(
                    phone_number,
                    f"Order {order['order_id']} already marked as delivered."
                )
        
        # Handle payment buttons
        elif message_text in ['paid_cash', 'paid cash', 'cash']:
            await db.orders.update_one(
                {"order_id": order['order_id']},
                {"$set": {
                    "payment_status": "paid",
                    "payment_method": "cash"
                }}
            )
            await send_whatsapp_message(
                phone_number,
                f"✅ Payment recorded!\n\nOrder {order['order_id']}\nAmount: ₹{order['amount']}\nMethod: Cash\n\nGreat work! 👍"
            )
        
        elif message_text in ['paid_upi', 'paid upi', 'upi']:
            await db.orders.update_one(
                {"order_id": order['order_id']},
                {"$set": {
                    "payment_status": "paid",
                    "payment_method": "upi"
                }}
            )
            await send_whatsapp_message(
                phone_number,
                f"✅ Payment recorded!\n\nOrder {order['order_id']}\nAmount: ₹{order['amount']}\nMethod: UPI\n\nGreat work! 👍"
            )
        
        elif message_text in ['not_paid', 'not paid', 'pending']:
            await send_whatsapp_message(
                phone_number,
                f"⏳ Payment pending for Order {order['order_id']}\n\nRemember to collect ₹{order['amount']} from customer."
            )
        
        else:
            await send_whatsapp_message(
                phone_number,
                f"Current Order: {order['order_id']}\n\nPlease update status:\n• Send 'DELIVERED' when done\n• Or use the buttons sent earlier"
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
    
    orders = await db.orders.find({"created_at": {"$regex": f"^{today}"}}).to_list(1000)
    
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

@api_router.get("/orders")
async def get_orders(status: Optional[str] = None, staff_id: Optional[str] = None, date_filter: Optional[str] = None):
    query = {}
    if status:
        query['status'] = status
    if staff_id:
        query['delivery_staff_id'] = staff_id
    if date_filter:
        query['created_at'] = {"$regex": f"^{date_filter}"}
    else:
        today = date.today().isoformat()
        query['created_at'] = {"$regex": f"^{today}"}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

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
    stock = await get_today_stock()
    
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
    staff = await db.delivery_staff.find({}, {"_id": 0}).to_list(100)
    return staff

@api_router.post("/delivery-staff")
async def create_delivery_staff(staff: DeliveryStaff):
    staff_dict = staff.model_dump()
    await db.delivery_staff.insert_one(staff_dict)
    return staff

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

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
