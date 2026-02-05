"""
Data Migration Script for Multi-Vendor Isolation

This script helps migrate existing data to the new multi-vendor structure.
For NEW vendors, data should be empty (no legacy data visible).

Usage:
  python migrate_vendor_data.py --check           # Show current data stats
  python migrate_vendor_data.py --assign-to <vendor_id>  # Assign orphan data to a vendor
  python migrate_vendor_data.py --list-vendors    # List all vendors
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'thanni_canuuu')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

async def check_data_stats():
    """Show statistics about data with and without vendor_id"""
    print("\n" + "="*60)
    print("DATA ISOLATION STATUS CHECK")
    print("="*60)
    
    collections = ['orders', 'customers', 'delivery_staff', 'delivery_shifts', 'stock', 'price_settings']
    
    for coll_name in collections:
        coll = db[coll_name]
        total = await coll.count_documents({})
        with_vendor = await coll.count_documents({"vendor_id": {"$exists": True, "$ne": None}})
        without_vendor = await coll.count_documents({"$or": [
            {"vendor_id": {"$exists": False}},
            {"vendor_id": None}
        ]})
        
        status = "✅" if without_vendor == 0 else "⚠️"
        print(f"\n{status} {coll_name}:")
        print(f"   Total: {total}")
        print(f"   With vendor_id: {with_vendor}")
        print(f"   Orphan (no vendor_id): {without_vendor}")

async def list_vendors():
    """List all registered vendors"""
    print("\n" + "="*60)
    print("REGISTERED VENDORS")
    print("="*60)
    
    vendors = await db.vendors.find({}).to_list(100)
    
    if not vendors:
        print("\nNo vendors registered yet.")
        return
    
    for v in vendors:
        vendor_id = str(v['_id'])
        name = v.get('name', 'N/A')
        business = v.get('business_name', 'N/A')
        phone = v.get('phone', 'N/A')
        
        # Count data for this vendor
        orders = await db.orders.count_documents({"vendor_id": vendor_id})
        customers = await db.customers.count_documents({"vendor_id": vendor_id})
        staff = await db.delivery_staff.count_documents({"vendor_id": vendor_id})
        
        print(f"\n📦 Vendor ID: {vendor_id}")
        print(f"   Name: {name}")
        print(f"   Business: {business}")
        print(f"   Phone: {phone}")
        print(f"   Data: {orders} orders, {customers} customers, {staff} staff")

async def assign_orphan_data(vendor_id: str):
    """Assign all orphan data (without vendor_id) to a specific vendor"""
    print(f"\n" + "="*60)
    print(f"ASSIGNING ORPHAN DATA TO VENDOR: {vendor_id}")
    print("="*60)
    
    # Verify vendor exists
    from bson import ObjectId
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        print(f"❌ Error: Vendor {vendor_id} not found!")
        return
    
    print(f"✅ Found vendor: {vendor.get('name', vendor.get('business_name'))}")
    
    collections = ['orders', 'customers', 'delivery_staff', 'delivery_shifts']
    
    for coll_name in collections:
        coll = db[coll_name]
        
        # Find orphan documents
        orphan_query = {"$or": [
            {"vendor_id": {"$exists": False}},
            {"vendor_id": None}
        ]}
        
        orphan_count = await coll.count_documents(orphan_query)
        
        if orphan_count > 0:
            result = await coll.update_many(
                orphan_query,
                {"$set": {"vendor_id": vendor_id}}
            )
            print(f"   {coll_name}: Assigned {result.modified_count} documents")
        else:
            print(f"   {coll_name}: No orphan documents")
    
    print("\n✅ Migration complete!")

async def main():
    import sys
    
    if len(sys.argv) < 2:
        print(__doc__)
        await check_data_stats()
        print("\n" + "-"*60)
        await list_vendors()
        return
    
    if sys.argv[1] == '--check':
        await check_data_stats()
    elif sys.argv[1] == '--list-vendors':
        await list_vendors()
    elif sys.argv[1] == '--assign-to':
        if len(sys.argv) < 3:
            print("Error: Please provide vendor_id")
            print("Usage: python migrate_vendor_data.py --assign-to <vendor_id>")
            return
        await assign_orphan_data(sys.argv[2])
    else:
        print(__doc__)

if __name__ == "__main__":
    asyncio.run(main())
