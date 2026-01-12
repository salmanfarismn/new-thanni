import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def init_staff():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    existing = await db.delivery_staff.count_documents({})
    
    if existing == 0:
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
            }
        ]
        
        await db.delivery_staff.insert_many(staff_data)
        print("✅ Delivery staff initialized successfully!")
        print(f"   - {staff_data[0]['name']} ({staff_data[0]['phone_number']})")
        print(f"   - {staff_data[1]['name']} ({staff_data[1]['phone_number']})")
    else:
        print("ℹ️  Delivery staff already exists in database")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(init_staff())
