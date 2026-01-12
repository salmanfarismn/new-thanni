import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, date

ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def init_database():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Initializing HydroFlow database...")
    
    # Initialize delivery staff
    existing_staff = await db.delivery_staff.count_documents({})
    
    if existing_staff == 0:
        staff_data = [
            {
                "staff_id": "STAFF001",
                "name": "Rajesh Kumar",
                "phone_number": "9876543210",
                "active_orders_count": 0
            },
            {
                "staff_id": "STAFF002",
                "name": "Suresh Patel",
                "phone_number": "9876543211",
                "active_orders_count": 0
            },
            {
                "staff_id": "STAFF003",
                "name": "Amit Singh",
                "phone_number": "9876543212",
                "active_orders_count": 0
            }
        ]
        
        await db.delivery_staff.insert_many(staff_data)
        print("✅ Delivery staff initialized successfully!")
        for staff in staff_data:
            print(f"   - {staff['name']} ({staff['phone_number']})")
    else:
        print("ℹ️  Delivery staff already exists in database")
    
    # Initialize price settings
    existing_prices = await db.price_settings.count_documents({})
    
    if existing_prices == 0:
        price_data = [
            {
                "litre_size": 20,
                "price_per_can": 45.0,
                "is_active": True,
                "updated_at": datetime.now(timezone.utc)
            },
            {
                "litre_size": 25,
                "price_per_can": 55.0,
                "is_active": True,
                "updated_at": datetime.now(timezone.utc)
            }
        ]
        
        await db.price_settings.insert_many(price_data)
        print("✅ Price settings initialized successfully!")
        for price in price_data:
            print(f"   - {price['litre_size']}L can: ₹{price['price_per_can']}")
    else:
        print("ℹ️  Price settings already exist in database")
    
    # Initialize today's delivery shifts
    today = date.today().isoformat()
    existing_shifts = await db.delivery_shifts.count_documents({"date": today})
    
    if existing_shifts == 0:
        shift_data = [
            {
                "date": today,
                "staff_id": "STAFF001",
                "staff_name": "Rajesh Kumar",
                "shift": "morning",
                "is_active": True,
                "updated_at": datetime.now(timezone.utc)
            },
            {
                "date": today,
                "staff_id": "STAFF002",
                "staff_name": "Suresh Patel",
                "shift": "evening",
                "is_active": True,
                "updated_at": datetime.now(timezone.utc)
            },
            {
                "date": today,
                "staff_id": "STAFF003",
                "staff_name": "Amit Singh",
                "shift": "full_day",
                "is_active": True,
                "updated_at": datetime.now(timezone.utc)
            }
        ]
        
        await db.delivery_shifts.insert_many(shift_data)
        print("✅ Today's delivery shifts initialized successfully!")
        for shift in shift_data:
            print(f"   - {shift['staff_name']}: {shift['shift']} shift")
    else:
        print("ℹ️  Today's delivery shifts already exist in database")
    
    # Initialize today's stock
    existing_stock = await db.stock.count_documents({"date": today})
    
    if existing_stock == 0:
        stock_data = {
            "date": today,
            "total_stock": 100,
            "available_stock": 100,
            "orders_count": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.stock.insert_one(stock_data)
        print("✅ Today's stock initialized successfully!")
        print(f"   - Total stock: {stock_data['total_stock']} cans")
        print(f"   - Available: {stock_data['available_stock']} cans")
    else:
        print("ℹ️  Today's stock already exists in database")
    
    # Create indexes for better performance
    try:
        await db.customers.create_index("phone_number", unique=True)
    except Exception:
        pass  # Index might already exist
    
    try:
        await db.orders.create_index("order_id", unique=True)
    except Exception:
        pass
    
    await db.orders.create_index("customer_phone")
    await db.orders.create_index("delivery_staff_id")
    await db.orders.create_index("created_at")
    
    try:
        await db.delivery_staff.create_index("staff_id", unique=True)
    except Exception:
        pass
    
    try:
        await db.delivery_staff.create_index("phone_number", unique=True)
    except Exception:
        pass
    
    await db.price_settings.create_index([("litre_size", 1), ("is_active", 1)])
    await db.delivery_shifts.create_index([("date", 1), ("staff_id", 1), ("shift", 1)])
    
    try:
        await db.stock.create_index("date", unique=True)
    except Exception:
        pass
    
    try:
        await db.customer_sessions.create_index("phone_number", unique=True)
    except Exception:
        pass
    
    print("✅ Database indexes created successfully!")
    
    client.close()
    print("\n🎉 HydroFlow database initialization complete!")
    print("\n📱 WhatsApp Bot Features:")
    print("   - Customer registration (name & address)")
    print("   - Litre size selection (20L/25L)")
    print("   - Quantity selection (1-10 cans)")
    print("   - Automatic staff assignment by shift")
    print("   - Delivery status updates by staff")
    print("   - Payment tracking (cash/UPI)")

if __name__ == "__main__":
    asyncio.run(init_database())