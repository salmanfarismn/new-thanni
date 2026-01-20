"""
Seed script to populate database with comprehensive sample data.
Run this script to create sample delivery staff, customers, orders, stock, and shifts.

Usage:
  python seed_data.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, date, timedelta
import os
import random
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Validate required environment variables
required_env_vars = ['MONGO_URL', 'DB_NAME']
missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
if missing_vars:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}. Please check your .env file.")

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def seed_database():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 50)
    print("Starting HydroFlow Database Seeding...")
    print("=" * 50)
    
    # Clear existing data
    print("\n[X] Clearing existing data...")
    await db.delivery_staff.delete_many({})
    await db.customers.delete_many({})
    await db.orders.delete_many({})
    await db.stock.delete_many({})
    await db.delivery_shifts.delete_many({})
    await db.customer_sessions.delete_many({})
    await db.price_settings.delete_many({})
    
    # ============================================
    # 1. DELIVERY STAFF
    # ============================================
    print("\n[+] Creating delivery staff...")
    delivery_staff = [
        {
            "staff_id": "DS001",
            "name": "Rajesh Kumar",
            "phone_number": "919876543210",
            "active_orders_count": 2,
            "is_active": True,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        },
        {
            "staff_id": "DS002",
            "name": "Priya Sharma",
            "phone_number": "919876543211",
            "active_orders_count": 1,
            "is_active": True,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=25)).isoformat()
        },
        {
            "staff_id": "DS003",
            "name": "Amit Patel",
            "phone_number": "919876543212",
            "active_orders_count": 0,
            "is_active": True,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
        },
        {
            "staff_id": "DS004",
            "name": "Kavitha Nair",
            "phone_number": "919876543213",
            "active_orders_count": 0,
            "is_active": False,  # Inactive staff
            "created_at": (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        }
    ]
    await db.delivery_staff.insert_many(delivery_staff)
    print(f"   [OK] Created {len(delivery_staff)} delivery staff (1 inactive)")
    
    # ============================================
    # 2. DELIVERY SHIFTS (Today + Tomorrow)
    # ============================================
    print("\n[+] Creating delivery shifts...")
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    
    shifts = [
        # Today's shifts
        {"date": today, "staff_id": "DS001", "staff_name": "Rajesh Kumar", "shift": "morning", "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()},
        {"date": today, "staff_id": "DS002", "staff_name": "Priya Sharma", "shift": "evening", "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()},
        {"date": today, "staff_id": "DS003", "staff_name": "Amit Patel", "shift": "full_day", "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()},
        # Tomorrow's shifts
        {"date": tomorrow, "staff_id": "DS001", "staff_name": "Rajesh Kumar", "shift": "full_day", "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()},
        {"date": tomorrow, "staff_id": "DS002", "staff_name": "Priya Sharma", "shift": "morning", "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.delivery_shifts.insert_many(shifts)
    print(f"   [OK] Created {len(shifts)} delivery shifts")
    
    # ============================================
    # 3. PRICE SETTINGS
    # ============================================
    print("\n[+] Creating price settings...")
    price_settings = [
        {"litre_size": 20, "price_per_can": 40.0, "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()},
        {"litre_size": 25, "price_per_can": 50.0, "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.price_settings.insert_many(price_settings)
    print(f"   [OK] Created {len(price_settings)} price settings")
    
    # ============================================
    # 4. CUSTOMERS
    # ============================================
    print("\n[+] Creating customers...")
    customers = [
        {"phone_number": "919123456781", "name": "Sunita Verma", "address": "123, MG Road, Bangalore", "created_at": datetime.now(timezone.utc).isoformat()},
        {"phone_number": "919123456782", "name": "Vikram Singh", "address": "456, Park Street, Kolkata", "created_at": datetime.now(timezone.utc).isoformat()},
        {"phone_number": "919123456783", "name": "Anita Desai", "address": "789, Marine Drive, Mumbai", "created_at": datetime.now(timezone.utc).isoformat()},
        {"phone_number": "919123456784", "name": "Ravi Krishnan", "address": "321, Anna Salai, Chennai", "created_at": datetime.now(timezone.utc).isoformat()},
        {"phone_number": "919123456785", "name": "Meera Reddy", "address": "654, Banjara Hills, Hyderabad", "created_at": datetime.now(timezone.utc).isoformat()},
        {"phone_number": "919123456786", "name": "Arjun Mehta", "address": "111, Connaught Place, Delhi", "created_at": datetime.now(timezone.utc).isoformat()},
        {"phone_number": "919123456787", "name": "Lakshmi Iyer", "address": "222, Bandra West, Mumbai", "created_at": datetime.now(timezone.utc).isoformat()},
        {"phone_number": "919123456788", "name": "Sanjay Gupta", "address": "333, Salt Lake, Kolkata", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.customers.insert_many(customers)
    print(f"   [OK] Created {len(customers)} customers")
    
    # ============================================
    # 5. STOCK (Today + Historical)
    # ============================================
    print("\n[+] Creating stock records...")
    stock_records = []
    for days_ago in range(7, -1, -1):  # Last 7 days + today
        stock_date = (date.today() - timedelta(days=days_ago)).isoformat()
        if days_ago == 0:  # Today
            stock_records.append({
                "date": stock_date,
                "total_stock": 100,
                "available_stock": 68,
                "orders_count": 8,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            total = random.randint(80, 120)
            used = random.randint(15, 40)
            stock_records.append({
                "date": stock_date,
                "total_stock": total,
                "available_stock": 0,  # Used up
                "orders_count": random.randint(8, 20),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
    await db.stock.insert_many(stock_records)
    print(f"   [OK] Created {len(stock_records)} stock records (8 days)")
    
    # ============================================
    # 6. ORDERS (Today + Historical)
    # ============================================
    print("\n[+] Creating orders...")
    orders = []
    order_counter = 1
    
    # Create historical orders for the past 7 days
    for days_ago in range(7, 0, -1):
        order_date = date.today() - timedelta(days=days_ago)
        num_orders = random.randint(8, 15)
        
        for i in range(num_orders):
            customer = random.choice(customers)
            staff_member = random.choice([s for s in delivery_staff if s['is_active']])
            litre_size = random.choice([20, 25])
            price = 40.0 if litre_size == 20 else 50.0
            quantity = random.randint(1, 5)
            
            order_time = datetime.combine(order_date, datetime.min.time().replace(
                hour=random.randint(6, 20),
                minute=random.randint(0, 59)
            )).replace(tzinfo=timezone.utc)
            
            orders.append({
                "order_id": f"ORD{order_time.strftime('%Y%m%d%H%M%S')}{order_counter:03d}",
                "customer_phone": customer['phone_number'],
                "customer_name": customer['name'],
                "customer_address": customer['address'],
                "litre_size": litre_size,
                "quantity": quantity,
                "price_per_can": price,
                "status": "delivered",
                "delivery_staff_id": staff_member['staff_id'],
                "delivery_staff_name": staff_member['name'],
                "payment_status": "paid",
                "payment_method": random.choice(["cash", "upi"]),
                "amount": price * quantity,
                "shift_assigned": random.choice(["morning", "evening"]),
                "created_at": order_time.isoformat(),
                "delivered_at": (order_time + timedelta(hours=random.randint(1, 3))).isoformat(),
                "notification_status": "sent",
                "notification_attempts": 1,
                "last_notification_error": None
            })
            order_counter += 1
    
    # Create today's orders
    today_date = date.today()
    base_time = datetime.now(timezone.utc)
    
    today_orders = [
        # Delivered & Paid orders
        {
            "order_id": f"ORD{(base_time - timedelta(hours=5)).strftime('%Y%m%d%H%M%S')}001",
            "customer_phone": "919123456781",
            "customer_name": "Sunita Verma",
            "customer_address": "123, MG Road, Bangalore",
            "litre_size": 20,
            "quantity": 3,
            "price_per_can": 40.0,
            "status": "delivered",
            "delivery_staff_id": "DS001",
            "delivery_staff_name": "Rajesh Kumar",
            "payment_status": "paid",
            "payment_method": "cash",
            "amount": 120.0,
            "shift_assigned": "morning",
            "created_at": (base_time - timedelta(hours=5)).isoformat(),
            "delivered_at": (base_time - timedelta(hours=3)).isoformat(),
            "notification_status": "sent",
            "notification_attempts": 1,
            "last_notification_error": None
        },
        {
            "order_id": f"ORD{(base_time - timedelta(hours=4)).strftime('%Y%m%d%H%M%S')}002",
            "customer_phone": "919123456782",
            "customer_name": "Vikram Singh",
            "customer_address": "456, Park Street, Kolkata",
            "litre_size": 25,
            "quantity": 4,
            "price_per_can": 50.0,
            "status": "delivered",
            "delivery_staff_id": "DS002",
            "delivery_staff_name": "Priya Sharma",
            "payment_status": "paid",
            "payment_method": "upi",
            "amount": 200.0,
            "shift_assigned": "morning",
            "created_at": (base_time - timedelta(hours=4)).isoformat(),
            "delivered_at": (base_time - timedelta(hours=2)).isoformat(),
            "notification_status": "sent",
            "notification_attempts": 1,
            "last_notification_error": None
        },
        {
            "order_id": f"ORD{(base_time - timedelta(hours=3)).strftime('%Y%m%d%H%M%S')}003",
            "customer_phone": "919123456786",
            "customer_name": "Arjun Mehta",
            "customer_address": "111, Connaught Place, Delhi",
            "litre_size": 20,
            "quantity": 2,
            "price_per_can": 40.0,
            "status": "delivered",
            "delivery_staff_id": "DS003",
            "delivery_staff_name": "Amit Patel",
            "payment_status": "paid",
            "payment_method": "cash",
            "amount": 80.0,
            "shift_assigned": "full_day",
            "created_at": (base_time - timedelta(hours=3)).isoformat(),
            "delivered_at": (base_time - timedelta(hours=1, minutes=30)).isoformat(),
            "notification_status": "sent",
            "notification_attempts": 1,
            "last_notification_error": None
        },
        # Delivered but payment pending
        {
            "order_id": f"ORD{(base_time - timedelta(hours=2)).strftime('%Y%m%d%H%M%S')}004",
            "customer_phone": "919123456783",
            "customer_name": "Anita Desai",
            "customer_address": "789, Marine Drive, Mumbai",
            "litre_size": 25,
            "quantity": 3,
            "price_per_can": 50.0,
            "status": "delivered",
            "delivery_staff_id": "DS001",
            "delivery_staff_name": "Rajesh Kumar",
            "payment_status": "pending",
            "payment_method": None,
            "amount": 150.0,
            "shift_assigned": "morning",
            "created_at": (base_time - timedelta(hours=2)).isoformat(),
            "delivered_at": (base_time - timedelta(minutes=45)).isoformat(),
            "notification_status": "sent",
            "notification_attempts": 1,
            "last_notification_error": None
        },
        # Pending delivery orders
        {
            "order_id": f"ORD{(base_time - timedelta(hours=1)).strftime('%Y%m%d%H%M%S')}005",
            "customer_phone": "919123456784",
            "customer_name": "Ravi Krishnan",
            "customer_address": "321, Anna Salai, Chennai",
            "litre_size": 20,
            "quantity": 5,
            "price_per_can": 40.0,
            "status": "pending",
            "delivery_staff_id": "DS001",
            "delivery_staff_name": "Rajesh Kumar",
            "payment_status": "pending",
            "payment_method": None,
            "amount": 200.0,
            "shift_assigned": "morning",
            "created_at": (base_time - timedelta(hours=1)).isoformat(),
            "delivered_at": None,
            "notification_status": "sent",
            "notification_attempts": 1,
            "last_notification_error": None
        },
        {
            "order_id": f"ORD{(base_time - timedelta(minutes=45)).strftime('%Y%m%d%H%M%S')}006",
            "customer_phone": "919123456785",
            "customer_name": "Meera Reddy",
            "customer_address": "654, Banjara Hills, Hyderabad",
            "litre_size": 25,
            "quantity": 2,
            "price_per_can": 50.0,
            "status": "pending",
            "delivery_staff_id": "DS001",
            "delivery_staff_name": "Rajesh Kumar",
            "payment_status": "pending",
            "payment_method": None,
            "amount": 100.0,
            "shift_assigned": "morning",
            "created_at": (base_time - timedelta(minutes=45)).isoformat(),
            "delivered_at": None,
            "notification_status": "sent",
            "notification_attempts": 1,
            "last_notification_error": None
        },
        {
            "order_id": f"ORD{(base_time - timedelta(minutes=30)).strftime('%Y%m%d%H%M%S')}007",
            "customer_phone": "919123456787",
            "customer_name": "Lakshmi Iyer",
            "customer_address": "222, Bandra West, Mumbai",
            "litre_size": 20,
            "quantity": 4,
            "price_per_can": 40.0,
            "status": "pending",
            "delivery_staff_id": "DS002",
            "delivery_staff_name": "Priya Sharma",
            "payment_status": "pending",
            "payment_method": None,
            "amount": 160.0,
            "shift_assigned": "evening",
            "created_at": (base_time - timedelta(minutes=30)).isoformat(),
            "delivered_at": None,
            "notification_status": "sent",
            "notification_attempts": 1,
            "last_notification_error": None
        },
        # Queued notification (just placed)
        {
            "order_id": f"ORD{(base_time - timedelta(minutes=5)).strftime('%Y%m%d%H%M%S')}008",
            "customer_phone": "919123456788",
            "customer_name": "Sanjay Gupta",
            "customer_address": "333, Salt Lake, Kolkata",
            "litre_size": 25,
            "quantity": 5,
            "price_per_can": 50.0,
            "status": "pending",
            "delivery_staff_id": "DS003",
            "delivery_staff_name": "Amit Patel",
            "payment_status": "pending",
            "payment_method": None,
            "amount": 250.0,
            "shift_assigned": "full_day",
            "created_at": (base_time - timedelta(minutes=5)).isoformat(),
            "delivered_at": None,
            "notification_status": "queued",
            "notification_attempts": 0,
            "last_notification_error": None
        },
    ]
    
    orders.extend(today_orders)
    await db.orders.insert_many(orders)
    
    today_count = len(today_orders)
    historical_count = len(orders) - today_count
    print(f"   [OK] Created {len(orders)} total orders")
    print(f"      - {historical_count} historical orders (past 7 days)")
    print(f"      - {today_count} today's orders (4 delivered, 4 pending)")
    
    client.close()
    
    # Summary
    print("\n" + "=" * 50)
    print("* Database seeding completed successfully!")
    print("=" * 50)
    print(f"""
Summary:
   Delivery Staff: {len(delivery_staff)} (3 active, 1 inactive)
   Shifts: {len(shifts)} (today + tomorrow)
   Price Settings: {len(price_settings)} (20L=40, 25L=50)
   Customers: {len(customers)}
  [+] Stock Records: {len(stock_records)} days
  [+] Orders: {len(orders)} total
      - Today: {today_count} orders ({sum(o['amount'] for o in today_orders)})
      - Historical: {historical_count} orders

Dashboard will show:
  + Total orders, delivered, pending counts
  + Cans sold and revenue metrics
  + Stock availability
  + Delivery staff with their orders
  + Sales filter data for week/month

Test Features:
  - Orders page: See all orders with notification status
  - Stock page: Current stock with add functionality
  - Settings: Price settings and navigation
  - Delivery Boys: Active/inactive staff management
  - Shifts: Staff scheduling for today/tomorrow
""")

if __name__ == "__main__":
    asyncio.run(seed_database())
