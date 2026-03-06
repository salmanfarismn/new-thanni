"""
Agent API router for Thanni Canuuu delivery agent system.
Provides endpoints for agent dashboard, orders, delivery completion, and damage reporting.
All endpoints require delivery_agent role via require_agent guard.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
import logging
import uuid
import shutil

from middleware.auth_guards import require_agent
from routers.auth import login_agent, AgentLoginRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Delivery Agent"])

# Database reference (set from main app)
db = None

# Upload directories
DAMAGE_UPLOAD_DIR = Path("static/uploads/damage")
DELIVERY_UPLOAD_DIR = Path("static/uploads/delivery")

def set_database(database):
    """Set the database instance from main app."""
    global db
    db = database
    # Ensure upload directories exist
    DAMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DELIVERY_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ============================================
# REQUEST / RESPONSE SCHEMAS
# ============================================

class CompleteOrderRequest(BaseModel):
    """Request to complete a delivery."""
    order_id: str = Field(..., description="Order ID to complete")
    payment_type: str = Field(..., description="Payment type: cash, upi, not_paid")
    empty_cans_collected: int = Field(default=0, ge=0, description="Number of empty cans collected")
    notes: Optional[str] = Field(default=None, max_length=500, description="Optional delivery notes")


# ============================================
# AGENT LOGIN ALIAS
# ============================================

@router.post("/login")
@router.post("/auth/login")
async def agent_login_alias(data: AgentLoginRequest, request: Request):
    """
    Alias for agent login.
    Points to the same logic in auth router.
    """
    return await login_agent(data, request)


# ============================================
# HELPER: save uploaded photo
# ============================================

def save_uploaded_photo(file: UploadFile, upload_dir: Path, prefix: str) -> str:
    """Save an uploaded photo and return the URL path."""
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    allowed_ext = {"jpg", "jpeg", "png", "webp", "heic"}
    if ext.lower() not in allowed_ext:
        ext = "jpg"
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.{ext.lower()}"
    filepath = upload_dir / filename
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return f"/static/uploads/{upload_dir.name}/{filename}"


# ============================================
# DASHBOARD ENDPOINT
# ============================================

@router.get("/dashboard")
async def get_agent_dashboard(agent: Dict = Depends(require_agent)):
    """
    Get agent dashboard metrics for today.
    Returns assigned orders count, pending deliveries, completed, earnings, cash total, etc.
    """
    agent_id = agent["agent_id"]
    vendor_id = agent["vendor_id"]
    
    # Today's date range in IST
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = datetime.now(timezone.utc) + ist_offset
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_ist - ist_offset
    
    today_str = now_ist.strftime("%Y-%m-%d")
    
    # Get assigned orders for this agent (all active ones, even if from yesterday)
    assigned_orders = await db.orders.count_documents({
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id,
        "status": {"$in": ["assigned", "out_for_delivery", "pending", "in_queue"]}
    })
    
    # Get today's completed deliveries (based on delivery time)
    # Use delivered_at instead of created_at to count deliveries made today
    completed_orders = await db.orders.count_documents({
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id,
        "status": "delivered",
        "delivered_at": {"$gte": today_start_utc.isoformat()}
    })
    
    # Get pending (in queue but assigned to this agent)
    pending_orders = await db.orders.count_documents({
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id,
        "status": "in_queue"
    })
    
    # Calculate today's earnings + cans + cash breakdown
    # Filter by delivered_at so we count earnings for deliveries MADE today
    earnings_pipeline = [
        {"$match": {
            "vendor_id": vendor_id,
            "delivery_staff_id": agent_id,
            "status": "delivered",
            "delivered_at": {"$gte": today_start_utc.isoformat()}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$amount"},
            "cans": {"$sum": "$quantity"},
            "total_empty": {"$sum": {"$ifNull": ["$empty_cans_collected", 0]}}
        }}
    ]
    earnings_result = await db.orders.aggregate(earnings_pipeline).to_list(1)
    today_earnings = earnings_result[0]["total"] if earnings_result else 0
    today_cans = earnings_result[0]["cans"] if earnings_result else 0
    empty_cans = earnings_result[0]["total_empty"] if earnings_result else 0
    
    # Cash collected today (only cash payments)
    # Filter by delivered_at/payment_confirmed_at? delivered_at is safer proxy for "cash collected on delivery"
    cash_pipeline = [
        {"$match": {
            "vendor_id": vendor_id,
            "delivery_staff_id": agent_id,
            "status": "delivered",
            "payment_status": "paid_cash",
            "delivered_at": {"$gte": today_start_utc.isoformat()}
        }},
        {"$group": {"_id": None, "cash_total": {"$sum": "$amount"}}}
    ]
    cash_result = await db.orders.aggregate(cash_pipeline).to_list(1)
    cash_collected = cash_result[0]["cash_total"] if cash_result else 0
    
    # UPI collected today
    upi_pipeline = [
        {"$match": {
            "vendor_id": vendor_id,
            "delivery_staff_id": agent_id,
            "status": "delivered",
            "payment_status": "paid_upi",
            "delivered_at": {"$gte": today_start_utc.isoformat()}
        }},
        {"$group": {"_id": None, "upi_total": {"$sum": "$amount"}}}
    ]
    upi_result = await db.orders.aggregate(upi_pipeline).to_list(1)
    upi_collected = upi_result[0]["upi_total"] if upi_result else 0
    
    # Get unpaid/pending payment orders
    unpaid_count = await db.orders.count_documents({
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id,
        "status": "delivered",
        "payment_status": {"$in": ["unpaid", "not_paid", "cash_due", None]}
    })

    # Get total outstanding amount for this agent
    outstanding_pipeline = [
        {"$match": {
            "vendor_id": vendor_id,
            "delivery_staff_id": agent_id,
            "status": "delivered",
            "payment_status": {"$in": [
                "pending", "upi_pending", "cash_due",
                "delivered_unpaid", "unpaid", "not_paid"
            ]}
        }},
        {"$group": {"_id": None, "total_outstanding": {"$sum": "$amount"}}}
    ]
    outstanding_result = await db.orders.aggregate(outstanding_pipeline).to_list(1)
    total_outstanding = outstanding_result[0]["total_outstanding"] if outstanding_result else 0
    
    # Get agent info
    agent_info = await db.delivery_staff.find_one({"staff_id": agent_id, "vendor_id": vendor_id})
    
    return {
        "agent_name": agent_info["name"] if agent_info else "Agent",
        "today_date": today_str,
        "metrics": {
            "assigned_orders": assigned_orders,
            "pending_orders": pending_orders,
            "completed_orders": completed_orders,
            "today_cans_delivered": today_cans,
            "today_earnings": today_earnings,
            "empty_cans_collected": empty_cans,
            "unpaid_orders": unpaid_count,
            "cash_collected": cash_collected,
            "upi_collected": upi_collected,
            "total_outstanding": total_outstanding
        }
    }


# ============================================
# ORDERS ENDPOINT
# ============================================

@router.get("/orders")
async def get_agent_orders(
    status: Optional[str] = Query(None, description="Filter by status: assigned, out_for_delivery, delivered"),
    agent: Dict = Depends(require_agent)
):
    """
    Get orders assigned to this agent.
    Filtered by vendor_id AND agent_id for strict isolation.
    """
    agent_id = agent["agent_id"]
    vendor_id = agent["vendor_id"]
    
    query = {
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id
    }
    
    if status:
        query["status"] = status
    else:
        # Default: show active orders ONLY
        query["status"] = {"$in": ["in_queue", "assigned", "out_for_delivery", "pending"]}
    
    orders = await db.orders.find(query).sort("created_at", -1).to_list(100)
    
    # Format orders for agent view
    formatted_orders = []
    for order in orders:
        formatted_orders.append({
            "order_id": order.get("order_id", str(order.get("_id", ""))),
            "customer_name": order.get("customer_name", "Unknown"),
            "customer_phone": order.get("customer_phone", ""),
            "customer_address": order.get("customer_address", ""),
            "litre_size": order.get("litre_size", 20),
            "quantity": order.get("quantity", 1),
            "amount": order.get("amount", order.get("price_per_can", 0) * order.get("quantity", 1)),
            "status": order.get("status", "pending"),
            "payment_status": order.get("payment_status", "unpaid"),
            "delivery_date": order.get("delivery_date"),
            "created_at": order.get("created_at"),
            "notes": order.get("notes", ""),
            "customer_notes": order.get("customer_notes", ""),
            "delivery_instructions": order.get("delivery_instructions", ""),
            "empty_cans_collected": order.get("empty_cans_collected", 0)
        })
    
    return {
        "orders": formatted_orders,
        "total": len(formatted_orders)
    }


# ============================================
# AGENT DUES ENDPOINTS
# ============================================

@router.get("/dues")
async def get_agent_dues(
    status: Optional[str] = Query(None, description="Filter: upi_pending, cash_due, delivered_unpaid, all"),
    agent: Dict = Depends(require_agent)
):
    """
    Get all unpaid orders delivered by this agent.
    Shows only dues related to this agent's deliveries.
    Returns customer name, address, amount, payment mode, and due status.
    """
    agent_id = agent["agent_id"]
    vendor_id = agent["vendor_id"]

    # Payment statuses that indicate unpaid/dues
    due_statuses = ["pending", "upi_pending", "cash_due", "delivered_unpaid", "unpaid", "not_paid"]

    query = {
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id,
        "status": "delivered",
    }

    if status and status != "all":
        query["payment_status"] = status
    else:
        query["payment_status"] = {"$in": due_statuses}

    orders = await db.orders.find(query).sort("delivered_at", -1).to_list(500)

    dues = []
    total_due = 0
    for order in orders:
        amount = order.get("amount", 0)
        total_due += amount
        dues.append({
            "order_id": order.get("order_id", ""),
            "customer_name": order.get("customer_name", "Unknown"),
            "customer_phone": order.get("customer_phone", ""),
            "customer_address": order.get("customer_address", ""),
            "amount": amount,
            "payment_status": order.get("payment_status", "unpaid"),
            "payment_method": order.get("payment_method"),
            "quantity": order.get("quantity", 1),
            "litre_size": order.get("litre_size", 20),
            "delivered_at": order.get("delivered_at", order.get("created_at", "")),
            "created_at": order.get("created_at", ""),
        })

    return {
        "dues": dues,
        "total": len(dues),
        "total_due_amount": total_due
    }


@router.get("/dues/summary")
async def get_agent_dues_summary(agent: Dict = Depends(require_agent)):
    """
    Get aggregated dues summary for the agent dashboard.
    Returns today's collections, pending dues, cleared dues, and total outstanding.
    """
    agent_id = agent["agent_id"]
    vendor_id = agent["vendor_id"]

    # Today's date range in IST
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = datetime.now(timezone.utc) + ist_offset
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_ist - ist_offset

    # Today's collections (paid today)
    collections_pipeline = [
        {"$match": {
            "vendor_id": vendor_id,
            "delivery_staff_id": agent_id,
            "status": "delivered",
            "payment_status": {"$in": ["paid_cash", "paid_upi"]},
            "delivered_at": {"$gte": today_start_utc.isoformat()}
        }},
        {"$group": {
            "_id": "$payment_status",
            "amount": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    collections = await db.orders.aggregate(collections_pipeline).to_list(10)
    today_cash = 0
    today_upi = 0
    today_cash_count = 0
    today_upi_count = 0
    for c in collections:
        if c["_id"] == "paid_cash":
            today_cash = c["amount"]
            today_cash_count = c["count"]
        elif c["_id"] == "paid_upi":
            today_upi = c["amount"]
            today_upi_count = c["count"]

    # Pending dues breakdown (all time for this agent)
    due_statuses = ["pending", "upi_pending", "cash_due", "delivered_unpaid", "unpaid", "not_paid"]
    pending_pipeline = [
        {"$match": {
            "vendor_id": vendor_id,
            "delivery_staff_id": agent_id,
            "status": "delivered",
            "payment_status": {"$in": due_statuses}
        }},
        {"$group": {
            "_id": "$payment_status",
            "amount": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    pending = await db.orders.aggregate(pending_pipeline).to_list(10)

    pending_breakdown = {}
    total_outstanding = 0
    total_pending_orders = 0
    for p in pending:
        pending_breakdown[p["_id"]] = {
            "amount": p["amount"],
            "count": p["count"]
        }
        total_outstanding += p["amount"]
        total_pending_orders += p["count"]

    return {
        "today": {
            "cash_collected": today_cash,
            "cash_orders": today_cash_count,
            "upi_collected": today_upi,
            "upi_orders": today_upi_count,
            "total_collected": today_cash + today_upi,
            "total_orders": today_cash_count + today_upi_count
        },
        "outstanding": {
            "total_amount": total_outstanding,
            "total_orders": total_pending_orders,
            "breakdown": pending_breakdown
        }
    }


# ============================================
# COMPLETE ORDER ENDPOINT (supports optional photo)
# ============================================

@router.post("/complete-order")
async def complete_order(
    order_id: str = Form(...),
    payment_type: str = Form(...),
    empty_cans_collected: int = Form(default=0),
    notes: Optional[str] = Form(default=None),
    photo: Optional[UploadFile] = File(default=None),
    agent: Dict = Depends(require_agent)
):
    """
    Complete a delivery with payment status and optional delivery photo proof.
    Updates order status, payment info, and vendor ledger.
    """
    agent_id = agent["agent_id"]
    vendor_id = agent["vendor_id"]
    
    # Find order - enforce vendor + agent ownership
    order = await db.orders.find_one({
        "order_id": order_id,
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id
    })
    
    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found or not assigned to you."
        )
    
    if order.get("status") == "delivered":
        # Idempotency: if this agent already delivered this order, return success
        # This prevents double-tap errors on mobile
        return {
            "success": True,
            "message": "Order already delivered (duplicate request ignored).",
            "order_id": order_id,
            "status": "delivered",
            "payment_status": order.get("payment_status", "unknown"),
            "delivery_photo_url": order.get("delivery_photo_url"),
            "idempotent": True
        }
    
    if order.get("status") == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Cannot complete a cancelled order."
        )
    
    # Map payment type — CRITICAL: 'not_paid' maps to 'delivered_unpaid'
    # to match dues tracking filters across the platform
    payment_status_map = {
        "cash": "paid_cash",
        "upi": "paid_upi",
        "not_paid": "delivered_unpaid"
    }
    payment_status = payment_status_map.get(payment_type, "delivered_unpaid")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Save delivery photo if provided
    delivery_photo_url = None
    if photo and photo.filename:
        delivery_photo_url = save_uploaded_photo(photo, DELIVERY_UPLOAD_DIR, f"del_{order_id[:8]}")
    
    # Update order
    update_data = {
        "status": "delivered",
        "payment_status": payment_status,
        "delivered_at": now,
        "delivered_by": agent_id,
        "updated_at": now,
        "empty_cans_collected": empty_cans_collected
    }
    
    if delivery_photo_url:
        update_data["delivery_photo_url"] = delivery_photo_url
    
    if payment_type in ["cash", "upi"]:
        update_data["payment_confirmed_at"] = now
        update_data["payment_method"] = payment_type
    
    if notes:
        update_data["delivery_notes"] = notes
    
    await db.orders.update_one(
        {"order_id": order_id, "vendor_id": vendor_id},
        {"$set": update_data}
    )
    
    # Update delivery staff active orders count
    await db.delivery_staff.update_one(
        {"staff_id": agent_id, "vendor_id": vendor_id},
        {
            "$inc": {
                "active_orders_count": -1,
                "total_deliveries": 1
            }
        }
    )
    
    # Note: empty_cans_collected are recorded in the order itself (already updated in update_one above).
    # They should NOT increment 'available_stock' because that field represents FULL water cans available for sale.
    # Empty cans are tracked separately via metrics.
    pass
    
    logger.info(f"Order {order_id} delivered by agent {agent_id} (payment: {payment_type}, photo: {bool(delivery_photo_url)})")

    # Emit real-time WebSocket event to vendor
    try:
        import asyncio
        from ws_manager import ws_manager
        import notification_service

        agent_info = await db.delivery_staff.find_one({"staff_id": agent_id, "vendor_id": vendor_id})
        agent_name = agent_info["name"] if agent_info else "Agent"

        asyncio.create_task(ws_manager.broadcast_event(
            vendor_id=vendor_id,
            event_type="order_delivered",
            data={
                "order_id": order_id,
                "agent_id": agent_id,
                "agent_name": agent_name,
                "customer_name": order.get("customer_name", ""),
                "amount": order.get("amount", 0),
                "payment_status": payment_status,
                "payment_type": payment_type,
                "empty_cans_collected": empty_cans_collected,
            }
        ))

        # Push notification to vendor
        asyncio.create_task(notification_service.notify_order_delivered(
            order={**order, "payment_status": payment_status},
            vendor_id=vendor_id,
            agent_name=agent_name
        ))
    except Exception as e:
        logger.warning(f"Failed to emit delivery event: {e}")
    
    return {
        "success": True,
        "message": f"Delivery completed! Payment: {payment_type}",
        "order_id": order_id,
        "status": "delivered",
        "payment_status": payment_status,
        "delivery_photo_url": delivery_photo_url
    }


# ============================================
# REPORT DAMAGE ENDPOINT (with photo upload)
# ============================================

@router.post("/report-damage")
async def report_damage(
    damaged_qty: int = Form(default=0),
    returned_qty: int = Form(default=0),
    reason: str = Form(default="other"),
    litre_size: int = Form(default=20),
    order_id: Optional[str] = Form(default=None),
    notes: Optional[str] = Form(default=None),
    photo: Optional[UploadFile] = File(default=None),
    agent: Dict = Depends(require_agent)
):
    """
    Report damaged or returned cans with optional photo evidence.
    Auto-updates stock based on reported quantities.
    """
    agent_id = agent["agent_id"]
    vendor_id = agent["vendor_id"]
    
    if damaged_qty == 0 and returned_qty == 0:
        raise HTTPException(
            status_code=400,
            detail="Please specify at least damaged or returned quantity."
        )
    
    # If order_id provided, verify it belongs to this agent
    if order_id:
        order = await db.orders.find_one({
            "order_id": order_id,
            "vendor_id": vendor_id,
            "delivery_staff_id": agent_id
        })
        if not order:
            raise HTTPException(
                status_code=404,
                detail="Order not found or not assigned to you."
            )
    
    now = datetime.now(timezone.utc).isoformat()
    report_id = f"DMG-{str(uuid.uuid4())[:8].upper()}"
    
    # Save photo if provided
    photo_url = None
    if photo and photo.filename:
        photo_url = save_uploaded_photo(photo, DAMAGE_UPLOAD_DIR, f"dmg_{report_id}")
    
    # Get agent name for vendor dashboard display
    agent_info = await db.delivery_staff.find_one({"staff_id": agent_id, "vendor_id": vendor_id})
    agent_name = agent_info["name"] if agent_info else "Unknown Agent"
    
    # Create damage report
    damage_doc = {
        "report_id": report_id,
        "order_id": order_id,
        "agent_id": agent_id,
        "agent_name": agent_name,
        "vendor_id": vendor_id,
        "damaged_qty": damaged_qty,
        "returned_qty": returned_qty,
        "reason": reason,
        "notes": notes,
        "litre_size": litre_size,
        "photo_url": photo_url,
        "created_at": now
    }
    
    await db.damage_reports.insert_one(damage_doc)
    
    # Update stock - deduct damaged, add returned
    ist_offset = timedelta(hours=5, minutes=30)
    today = (datetime.now(timezone.utc) + ist_offset).strftime("%Y-%m-%d")
    
    stock_update = {}
    if damaged_qty > 0:
        stock_update["available_stock"] = -damaged_qty
    if returned_qty > 0:
        stock_update["available_stock"] = stock_update.get("available_stock", 0) + returned_qty
    
    if stock_update:
        await db.stock.update_one(
            {"date": today, "vendor_id": vendor_id},
            {"$inc": stock_update}
        )
    
    logger.info(f"Damage report {report_id} by {agent_name} ({agent_id}): damaged={damaged_qty}, returned={returned_qty}, photo={bool(photo_url)})")

    # Emit real-time WebSocket event to vendor
    try:
        import asyncio
        from ws_manager import ws_manager
        import notification_service

        event_data = {
            "report_id": report_id,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "order_id": order_id,
            "damaged_qty": damaged_qty,
            "returned_qty": returned_qty,
            "reason": reason,
            "litre_size": litre_size,
        }
        asyncio.create_task(ws_manager.broadcast_event(
            vendor_id=vendor_id,
            event_type="damage_report",
            data=event_data
        ))

        # Also emit stock_update event
        asyncio.create_task(ws_manager.broadcast_event(
            vendor_id=vendor_id,
            event_type="stock_update",
            data={
                "source": "damage_report",
                "report_id": report_id,
                "stock_change": stock_update.get("available_stock", 0),
            }
        ))

        # Push notification to vendor
        asyncio.create_task(notification_service.notify_damage_report(
            report=damage_doc,
            vendor_id=vendor_id
        ))
    except Exception as e:
        logger.warning(f"Failed to emit damage report event: {e}")
    
    return {
        "success": True,
        "message": f"Damage report filed: {damaged_qty} damaged, {returned_qty} returned",
        "report_id": report_id,
        "photo_url": photo_url
    }


# ============================================
# AGENT HISTORY ENDPOINT
# ============================================

@router.get("/history")
async def get_agent_history(
    days: Optional[int] = Query(None, ge=1, le=90, description="Number of days of history"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    agent: Dict = Depends(require_agent)
):
    """
    Get agent's delivery history.
    Supports predefined 'days' or a custom 'start_date' and 'end_date' range.
    """
    agent_id = agent["agent_id"]
    vendor_id = agent["vendor_id"]
    
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = datetime.now(timezone.utc) + ist_offset
    
    query = {
        "vendor_id": vendor_id,
        "delivery_staff_id": agent_id,
        "status": "delivered"
    }

    if start_date and end_date:
        # Custom Range
        try:
            # Shift IST dates to UTC boundaries for mongo query
            # IST midnight = 18:30 UTC previous day
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            e_dt = datetime.strptime(end_date, "%Y-%m-%d")
            
            s_utc = (s_dt - ist_offset).replace(hour=18, minute=30, second=0).isoformat()
            e_utc = (e_dt - ist_offset).replace(hour=18, minute=29, second=59).isoformat()
            
            # Actually, delivered_at is often stored as ISO string in backend
            # To be safe, we use the date part or just bound it
            query["delivered_at"] = {"$gte": s_utc, "$lte": e_utc}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    elif days:
        # Predefined Days
        if days == 1:
            # Strict "Today" from midnight IST
            today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
            cutoff_utc = (today_start_ist - ist_offset).isoformat()
        else:
            cutoff = now_ist - timedelta(days=days)
            cutoff_utc = (cutoff - ist_offset).isoformat()
        query["delivered_at"] = {"$gte": cutoff_utc}
    else:
        # Default 30 days
        cutoff = now_ist - timedelta(days=30)
        cutoff_utc = (cutoff - ist_offset).isoformat()
        query["delivered_at"] = {"$gte": cutoff_utc}
    
    orders = await db.orders.find(query).sort("delivered_at", -1).to_list(1000)
    
    history = []
    total_earnings = 0
    total_empty_cans = 0
    total_cash = 0
    total_upi = 0
    
    for order in orders:
        amount = order.get("amount", 0)
        empty = order.get("empty_cans_collected", 0)
        total_earnings += amount
        total_empty_cans += empty
        
        ps = order.get("payment_status", "")
        if ps == "paid_cash":
            total_cash += amount
        elif ps == "paid_upi":
            total_upi += amount
        
        history.append({
            "order_id": order.get("order_id", ""),
            "customer_name": order.get("customer_name", ""),
            "quantity": order.get("quantity", 1),
            "amount": amount,
            "payment_status": ps,
            "delivered_at": order.get("delivered_at", order.get("updated_at", "")),
            "empty_cans_collected": empty,
            "delivery_photo_url": order.get("delivery_photo_url")
        })
    
    return {
        "history": history,
        "total": len(history),
        "summary": {
            "total_earnings": total_earnings,
            "total_empty_cans": total_empty_cans,
            "total_cash": total_cash,
            "total_upi": total_upi
        }
    }
