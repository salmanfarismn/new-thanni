import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def init_prices():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    existing = await db.price_settings.count_documents({})
    
    if existing == 0:
        price_data = [
            {
                "litre_size": 20,
                "price_per_can": 45.0,
                "is_active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "litre_size": 25,
                "price_per_can": 55.0,
                "is_active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        await db.price_settings.insert_many(price_data)
        print("✅ Price settings initialized successfully!")
        print(f"   - 20L water can: ₹{price_data[0]['price_per_can']}")
        print(f"   - 25L water can: ₹{price_data[1]['price_per_can']}")
    else:
        print("ℹ️  Price settings already exist in database")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(init_prices())
