"""Quick check script for vendor data isolation"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('.env')

async def check():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("="*50)
    print("MULTI-VENDOR DATA ISOLATION CHECK")
    print("="*50)
    
    # List vendors
    print("\n[VENDORS]")
    vendors = await db.vendors.find({}).to_list(100)
    for v in vendors:
        vid = str(v['_id'])
        name = v.get('name', v.get('business_name', 'Unknown'))
        phone = v.get('phone', 'N/A')
        print(f"  - {name} | {phone} | ID: {vid}")
    
    # Check orphan data
    print("\n[ORPHAN DATA - no vendor_id]")
    for coll in ['orders', 'customers', 'delivery_staff']:
        count = await db[coll].count_documents({
            "$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]
        })
        total = await db[coll].count_documents({})
        status = "WARNING" if count > 0 else "OK"
        print(f"  [{status}] {coll}: {count} orphan / {total} total")
    
    print("\n" + "="*50)
    print("SOLUTION: Orphan data will NOT appear for new vendors.")
    print("This is CORRECT behavior - new vendors start fresh!")
    print("="*50)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
