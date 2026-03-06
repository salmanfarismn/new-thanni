"""
Push Notification Service for ThanniCanuuu.

Handles FCM token registration and push notification delivery.
Falls back gracefully if Firebase is not configured.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Database reference (set from main app)
db = None

# Firebase Admin SDK — optional, graceful fallback
_firebase_app = None
_messaging = None

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    import os

    cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        _messaging = messaging
        logger.info("Firebase Admin SDK initialized successfully")
    else:
        logger.warning("Firebase credentials not found. Push notifications disabled. Set FIREBASE_CREDENTIALS_PATH in .env")
except ImportError:
    logger.warning("firebase-admin not installed. Push notifications disabled. Run: pip install firebase-admin")
except Exception as e:
    logger.warning(f"Firebase initialization failed: {e}. Push notifications disabled.")


def set_database(database):
    """Set the database instance from main app."""
    global db
    db = database


async def register_device_token(
    user_id: str,
    vendor_id: str,
    role: str,
    token: str,
    device_type: str = "web"
) -> bool:
    """
    Register or update an FCM device token for a user.
    
    Args:
        user_id: vendor_id or agent staff_id
        vendor_id: vendor scope for isolation
        role: 'vendor' or 'delivery_agent'
        token: FCM device token
        device_type: 'web', 'android', or 'ios'
    """
    if db is None:
        logger.error("Database not initialized for notification service")
        return False

    now = datetime.now(timezone.utc).isoformat()

    await db.fcm_tokens.update_one(
        {"user_id": user_id, "vendor_id": vendor_id, "token": token},
        {"$set": {
            "user_id": user_id,
            "vendor_id": vendor_id,
            "role": role,
            "token": token,
            "device_type": device_type,
            "updated_at": now
        }},
        upsert=True
    )
    logger.info(f"FCM token registered for {role} {user_id} (device: {device_type})")
    return True


async def send_push_notification(
    user_id: str,
    vendor_id: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    sound: str = "default",
    category: str = "system"
) -> int:
    """
    Send push notification to all devices registered for a user.
    Enforces notification preferences before sending.
    
    Args:
        category: 'order', 'payment', or 'system' — used to check preference toggles
    
    Returns:
        Number of notifications sent successfully.
    """
    if _messaging is None or db is None:
        logger.debug(f"Push notification skipped (FCM not configured): {title}")
        return 0

    # Check notification preferences
    prefs = await db.notification_preferences.find_one(
        {"user_id": user_id, "vendor_id": vendor_id}
    )
    if prefs:
        # Check global push toggle
        if not prefs.get("push_enabled", True):
            logger.debug(f"Push disabled for {user_id}, skipping: {title}")
            return 0
        
        # Check category-specific toggle
        category_map = {
            "order": "order_alerts",
            "payment": "payment_alerts",
            "system": "system_alerts"
        }
        pref_key = category_map.get(category, "system_alerts")
        if not prefs.get(pref_key, True):
            logger.debug(f"{pref_key} disabled for {user_id}, skipping: {title}")
            return 0
        
        # Check sound preference
        if not prefs.get("sound_enabled", True):
            sound = "default"  # Use default (silent) instead of custom sound

    # Get all tokens for this user
    tokens_cursor = db.fcm_tokens.find({
        "user_id": user_id,
        "vendor_id": vendor_id
    })
    tokens = await tokens_cursor.to_list(10)

    if not tokens:
        return 0

    sent_count = 0
    stale_tokens = []

    for token_doc in tokens:
        fcm_token = token_doc["token"]
        try:
            message = _messaging.Message(
                notification=_messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                token=fcm_token,
                android=_messaging.AndroidConfig(
                    notification=_messaging.AndroidNotification(
                        sound=sound,
                        channel_id="orders",
                        priority="high",
                    )
                ),
                webpush=_messaging.WebpushConfig(
                    notification=_messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon="/logo192.png",
                    ),
                    fcm_options=_messaging.WebpushFCMOptions(
                        link="/orders"
                    )
                )
            )
            _messaging.send(message)
            sent_count += 1
        except _messaging.UnregisteredError:
            stale_tokens.append(fcm_token)
        except Exception as e:
            logger.error(f"FCM send error for token {fcm_token[:20]}...: {e}")

    # Cleanup stale tokens
    if stale_tokens:
        await db.fcm_tokens.delete_many({
            "token": {"$in": stale_tokens},
            "vendor_id": vendor_id
        })
        logger.info(f"Cleaned {len(stale_tokens)} stale FCM tokens")

    logger.info(f"Push notification sent to {sent_count}/{len(tokens)} devices for {user_id}: {title}")
    return sent_count


async def notify_new_order(order: dict, vendor_id: str, agent_id: Optional[str] = None):
    """
    Send push notifications for a new order.
    Notifies vendor and assigned agent (if any).
    """
    customer = order.get("customer_name", "Customer")
    quantity = order.get("quantity", 1)
    amount = order.get("amount", 0)
    order_id = order.get("order_id", "")

    data = {
        "type": "new_order",
        "order_id": order_id,
        "click_action": f"/orders"
    }

    # Notify vendor
    await send_push_notification(
        user_id=vendor_id,
        vendor_id=vendor_id,
        title="🚰 New Order!",
        body=f"{customer} ordered {quantity} can(s) — ₹{amount}",
        data=data,
        sound="water_drop"
    )

    # Notify assigned agent
    if agent_id:
        data["click_action"] = "/agent/orders"
        await send_push_notification(
            user_id=agent_id,
            vendor_id=vendor_id,
            title="📦 New Delivery Assignment!",
            body=f"Deliver {quantity} can(s) to {customer} — ₹{amount}",
            data=data,
            sound="water_drop"
        )


async def notify_order_delivered(order: dict, vendor_id: str, agent_name: str = "Agent"):
    """Notify vendor when an order is delivered."""
    customer = order.get("customer_name", "Customer")
    amount = order.get("amount", 0)
    payment_status = order.get("payment_status", "unknown")

    await send_push_notification(
        user_id=vendor_id,
        vendor_id=vendor_id,
        title="✅ Order Delivered!",
        body=f"{agent_name} delivered to {customer} — ₹{amount} ({payment_status})",
        data={
            "type": "order_delivered",
            "order_id": order.get("order_id", ""),
            "click_action": "/orders"
        }
    )


async def notify_damage_report(report: dict, vendor_id: str):
    """Notify vendor when an agent reports damage."""
    agent_name = report.get("agent_name", "Agent")
    damaged = report.get("damaged_qty", 0)
    returned = report.get("returned_qty", 0)

    parts = []
    if damaged > 0:
        parts.append(f"{damaged} damaged")
    if returned > 0:
        parts.append(f"{returned} returned")

    await send_push_notification(
        user_id=vendor_id,
        vendor_id=vendor_id,
        title="⚠️ Damage Report Filed",
        body=f"{agent_name}: {', '.join(parts)}",
        data={
            "type": "damage_report",
            "report_id": report.get("report_id", ""),
            "click_action": "/stock"
        }
    )
