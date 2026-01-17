"""
Seed script to populate database with sample data for demo purposes.
Run this script to create sample delivery staff, customers, orders, and stock.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, date, timedelta
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def seed_database():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🌱 Starting database seeding...")
    
    # Clear existing data (optional - comment out if you want to keep data)
    print("Clearing existing data...")
    await db.delivery_staff.delete_many({})
    await db.customers.delete_many({})
    await db.orders.delete_many({})
    await db.stock.delete_many({})
    await db.delivery_shifts.delete_many({})
    await db.customer_sessions.delete_many({})
    await db.price_settings.delete_many({})
    
    # Seed Delivery Staff
    print("Creating delivery staff...")
    delivery_staff = [
        {
            "staff_id": "DS001",
            "name": "Rajesh Kumar",
            "phone_number": "919876543210",
            "active_orders_count": 0
        },
        {
            "staff_id": "DS002",
            "name": "Priya Sharma",
            "phone_number": "919876543211",
            "active_orders_count": 0
        },
        {
            "staff_id": "DS003",
            "name": "Amit Patel",
            "phone_number": "919876543212",
            "active_orders_count": 0
        }
    ]
    await db.delivery_staff.insert_many(delivery_staff)
    print(f"✓ Created {len(delivery_staff)} delivery staff")
    
    # Seed Delivery Shifts
    print("Creating delivery shifts...")
    today = date.today().isoformat()
    shifts = [
        {
            "date": today,
            "staff_id": "DS001",
            "staff_name": "Rajesh Kumar",
            "shift": "morning",
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "date": today,
            "staff_id": "DS002",
            "staff_name": "Priya Sharma",
            "shift": "evening",
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "date": today,
            "staff_id": "DS003",
            "staff_name": "Amit Patel",
            "shift": "full_day",
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.delivery_shifts.insert_many(shifts)
    print(f"✓ Created {len(shifts)} delivery shifts")
    
    # Seed Price Settings
    print("Creating price settings...")
    price_settings = [
        {
            "litre_size": 20,
            "price_per_can": 40.0,
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "litre_size": 25,
            "price_per_can": 50.0,
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.price_settings.insert_many(price_settings)
    print(f"✓ Created {len(price_settings)} price settings")
    
    # Seed Customers
    print("Creating customers...")
    customers = [
        {
            "phone_number": "919123456781",
            "name": "Sunita Verma",
            "address": "123, MG Road, Bangalore",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "phone_number": "919123456782",
            "name": "Vikram Singh",
            "address": "456, Park Street, Kolkata",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "phone_number": "919123456783",
            "name": "Anita Desai",
            "address": "789, Marine Drive, Mumbai",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "phone_number": "919123456784",
            "name": "Ravi Krishnan",
            "address": "321, Anna Salai, Chennai",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "phone_number": "919123456785",
            "name": "Meera Reddy",
            "address": "654, Banjara Hills, Hyderabad",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.customers.insert_many(customers)
    print(f"✓ Created {len(customers)} customers")
    
    # Seed Stock
    print("Creating stock...")
    stock = {
        "date": today,
        "total_stock": 100,
        "available_stock": 75,
        "orders_count": 5,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock.insert_one(stock)
    print("✓ Created today's stock")
    
    # Seed Orders
    print("Creating orders...")
    base_time = datetime.now(timezone.utc)
    orders = [
        {
            "order_id": f"ORD{(base_time - timedelta(hours=4)).strftime('%Y%m%d%H%M%S')}",
            "customer_phone": "919123456781",
            "customer_name": "Sunita Verma",
            "customer_address": "123, MG Road, Bangalore",
            "litre_size": 20,
            "quantity": 2,
            "price_per_can": 40.0,
            "status": "delivered",
            "delivery_staff_id": "DS001",
            "delivery_staff_name": "Rajesh Kumar",
            "payment_status": "paid",
            "payment_method": "cash",
            "amount": 80.0,
            "shift_assigned": "morning",
            "created_at": (base_time - timedelta(hours=4)).isoformat(),
            "delivered_at": (base_time - timedelta(hours=2)).isoformat()
        },
        {
            "order_id": f"ORD{(base_time - timedelta(hours=3)).strftime('%Y%m%d%H%M%S')}",
            "customer_phone": "919123456782",
            "customer_name": "Vikram Singh",
            "customer_address": "456, Park Street, Kolkata",
            "litre_size": 25,
            "quantity": 3,
            "price_per_can": 50.0,
            "status": "delivered",
            "delivery_staff_id": "DS002",
            "delivery_staff_name": "Priya Sharma",
            "payment_status": "paid",
            "payment_method": "upi",
            "amount": 150.0,
            "shift_assigned": "morning",
            "created_at": (base_time - timedelta(hours=3)).isoformat(),
            "delivered_at": (base_time - timedelta(hours=1)).isoformat()
        },
        {
            "order_id": f"ORD{(base_time - timedelta(hours=2)).strftime('%Y%m%d%H%M%S')}",
            "customer_phone": "919123456783",
            "customer_name": "Anita Desai",
            "customer_address": "789, Marine Drive, Mumbai",
            "litre_size": 20,
            "quantity": 5,
            "price_per_can": 40.0,
            "status": "pending",
            "delivery_staff_id": "DS003",
            "delivery_staff_name": "Amit Patel",
            "payment_status": "pending",
            "payment_method": None,
            "amount": 200.0,
            "shift_assigned": "full_day",
            "created_at": (base_time - timedelta(hours=2)).isoformat(),
            "delivered_at": None
        },
        {
            "order_id": f"ORD{(base_time - timedelta(hours=1)).strftime('%Y%m%d%H%M%S')}",
            "customer_phone": "919123456784",
            "customer_name": "Ravi Krishnan",
            "customer_address": "321, Anna Salai, Chennai",
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
            "created_at": (base_time - timedelta(hours=1)).isoformat(),
            "delivered_at": None
        },
        {
            "order_id": f"ORD{base_time.strftime('%Y%m%d%H%M%S')}",
            "customer_phone": "919123456785",
            "customer_name": "Meera Reddy",
            "customer_address": "654, Banjara Hills, Hyderabad",
            "litre_size": 20,
            "quantity": 3,
            "price_per_can": 40.0,
            "status": "delivered",
            "delivery_staff_id": "DS002",
            "delivery_staff_name": "Priya Sharma",
            "payment_status": "pending",
            "payment_method": None,
            "amount": 120.0,
            "shift_assigned": "evening",
            "created_at": base_time.isoformat(),
            "delivered_at": base_time.isoformat()
        }
    ]
    await db.orders.insert_many(orders)
    print(f"✓ Created {len(orders)} orders")
    
    # Update delivery staff active order counts
    await db.delivery_staff.update_one(
        {"staff_id": "DS001"},
        {"$set": {"active_orders_count": 1}}
    )
    await db.delivery_staff.update_one(
        {"staff_id": "DS003"},
        {"$set": {"active_orders_count": 1}}
    )
    
    client.close()
    print("\n✅ Database seeding completed successfully!")
    print(f"   - {len(delivery_staff)} delivery staff")
    print(f"   - {len(customers)} customers")
    print(f"   - {len(orders)} orders (3 delivered, 2 pending)")
    print(f"   - Stock: {stock['available_stock']}/{stock['total_stock']} cans available")

if __name__ == "__main__":
    asyncio.run(seed_database())
