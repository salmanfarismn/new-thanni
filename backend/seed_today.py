from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from datetime import date, datetime, timezone

async def seed():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["thanni_canuuu"]
    
    vendor_id = "69820583c9486dbe5be440d4"
    today = date.today().isoformat()
    
    # 1. Seed Stock
    stock = {
        "vendor_id": vendor_id,
        "date": today,
        "total_stock": 100,
        "available_stock": 100,
        "orders_count": 0,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock.update_one(
        {"vendor_id": vendor_id, "date": today},
        {"$set": stock},
        upsert=True
    )
    print(f"Stock seeded for {today}")
    
    # 2. Ensure Jagan is active and has a shift today
    staff_id = "DA94685780"
    await db.delivery_staff.update_one(
        {"staff_id": staff_id},
        {"$set": {"is_active": True}}
    )
    
    shift = {
        "vendor_id": vendor_id,
        "staff_id": staff_id,
        "staff_name": "Jagan",
        "date": today,
        "shift": "full_day",
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.delivery_shifts.update_one(
        {"vendor_id": vendor_id, "staff_id": staff_id, "date": today},
        {"$set": shift},
        upsert=True
    )
    print(f"Staff & Shift ensured for {today}")

if __name__ == "__main__":
    asyncio.run(seed())
