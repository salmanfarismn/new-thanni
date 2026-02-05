"""Detailed vendor data check"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('.env')

async def check():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("="*60)
    print("DETAILED VENDOR DATA CHECK")
    print("="*60)
    
    # List vendors with their data counts
    vendors = await db.vendors.find({}).to_list(100)
    
    for v in vendors:
        vid = str(v['_id'])
        name = v.get('name', v.get('business_name', 'Unknown'))
        business = v.get('business_name', 'N/A')
        phone = v.get('phone', 'N/A')
        
        # Count data for this vendor
        orders = await db.orders.count_documents({"vendor_id": vid})
        customers = await db.customers.count_documents({"vendor_id": vid})
        staff = await db.delivery_staff.count_documents({"vendor_id": vid})
        
        print(f"\n--- {name} ({business}) ---")
        print(f"  Phone: {phone}")
        print(f"  Vendor ID: {vid}")
        print(f"  Orders: {orders}")
        print(f"  Customers: {customers}")
        print(f"  Staff: {staff}")
    
    print("\n" + "="*60)
    
    # Show orphan data details
    print("\nORPHAN ORDERS (no vendor_id):")
    orphan_orders = await db.orders.find({
        "$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]
    }).to_list(10)
    for o in orphan_orders:
        print(f"  - Order {o.get('order_id')}: {o.get('customer_name')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
