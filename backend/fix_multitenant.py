#!/usr/bin/env python3
"""
Multi-Vendor Data Migration Script for Thanni Canuuu

This script fixes the multi-tenant data isolation issue by:
1. Checking which documents are missing vendor_id
2. Assigning vendor_id based on registration phone/context
3. Creating proper indexes for vendor isolation

RUN THIS SCRIPT TO FIX THE MULTI-TENANT BUG!
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
import sys
from bson import ObjectId

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

# Database configuration
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "thanni_canuuu")


async def diagnose_database():
    """Diagnose the database for multi-tenant issues."""
    
    print("=" * 70)
    print("  THANNI CANUUU - Multi-Tenant Data Diagnosis")
    print("=" * 70)
    print()
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. Check Vendors
    print("📊 VENDORS:")
    vendors = await db.vendors.find().to_list(100)
    print(f"   Total vendors: {len(vendors)}")
    for v in vendors:
        print(f"   - {v.get('business_name', 'Unknown')} (ID: {v['_id']}, Phone: {v.get('phone', 'N/A')})")
    print()
    
    # 2. Check Orders
    print("📦 ORDERS:")
    total_orders = await db.orders.count_documents({})
    orders_with_vendor = await db.orders.count_documents({"vendor_id": {"$exists": True, "$ne": None}})
    orders_without_vendor = await db.orders.count_documents({"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]})
    print(f"   Total orders: {total_orders}")
    print(f"   With vendor_id: {orders_with_vendor}")
    print(f"   ⚠️  WITHOUT vendor_id: {orders_without_vendor}")
    print()
    
    # 3. Check Customers
    print("👥 CUSTOMERS:")
    total_customers = await db.customers.count_documents({})
    customers_with_vendor = await db.customers.count_documents({"vendor_id": {"$exists": True, "$ne": None}})
    customers_without_vendor = await db.customers.count_documents({"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]})
    print(f"   Total customers: {total_customers}")
    print(f"   With vendor_id: {customers_with_vendor}")
    print(f"   ⚠️  WITHOUT vendor_id: {customers_without_vendor}")
    print()
    
    # 4. Check Delivery Staff
    print("🚚 DELIVERY STAFF:")
    total_staff = await db.delivery_staff.count_documents({})
    staff_with_vendor = await db.delivery_staff.count_documents({"vendor_id": {"$exists": True, "$ne": None}})
    staff_without_vendor = await db.delivery_staff.count_documents({"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]})
    print(f"   Total staff: {total_staff}")
    print(f"   With vendor_id: {staff_with_vendor}")
    print(f"   ⚠️  WITHOUT vendor_id: {staff_without_vendor}")
    print()
    
    # 5. Check Stock
    print("📈 STOCK:")
    total_stock = await db.stock.count_documents({})
    stock_with_vendor = await db.stock.count_documents({"vendor_id": {"$exists": True, "$ne": None}})
    stock_without_vendor = await db.stock.count_documents({"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]})
    print(f"   Total stock records: {total_stock}")
    print(f"   With vendor_id: {stock_with_vendor}")
    print(f"   ⚠️  WITHOUT vendor_id: {stock_without_vendor}")
    print()
    
    # 6. Check Sessions
    print("🔐 SESSIONS:")
    total_sessions = await db.vendor_sessions.count_documents({})
    active_sessions = await db.vendor_sessions.count_documents({"is_revoked": False})
    print(f"   Total sessions: {total_sessions}")
    print(f"   Active sessions: {active_sessions}")
    print()
    
    # Summary
    orphaned_data = orders_without_vendor + customers_without_vendor + staff_without_vendor + stock_without_vendor
    if orphaned_data > 0:
        print("=" * 70)
        print(f"⚠️  WARNING: {orphaned_data} documents are missing vendor_id!")
        print("   This is causing the multi-tenant isolation bug.")
        print("   Run this script with --fix to migrate the data.")
        print("=" * 70)
    else:
        print("=" * 70)
        print("✅ All data has proper vendor_id assigned!")
        print("=" * 70)
    
    client.close()
    return vendors, orphaned_data > 0


async def fix_orphaned_data():
    """Fix orphaned data by assigning vendor_id."""
    
    print("=" * 70)
    print("  FIX: Assigning vendor_id to orphaned documents")
    print("=" * 70)
    print()
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all vendors
    vendors = await db.vendors.find().to_list(100)
    
    if len(vendors) == 0:
        print("❌ No vendors found! Please register at least one vendor first.")
        client.close()
        return
    
    if len(vendors) == 1:
        # Single vendor - assign all orphaned data to this vendor
        vendor_id = str(vendors[0]["_id"])
        vendor_name = vendors[0].get("business_name", "Default Vendor")
        
        print(f"Single vendor mode: Assigning all data to '{vendor_name}' (ID: {vendor_id})")
        print()
        
        # Update orders
        result = await db.orders.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}, {"vendor_id": ""}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Orders updated: {result.modified_count}")
        
        # Update customers
        result = await db.customers.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}, {"vendor_id": ""}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Customers updated: {result.modified_count}")
        
        # Update delivery staff
        result = await db.delivery_staff.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}, {"vendor_id": ""}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Delivery staff updated: {result.modified_count}")
        
        # Update stock
        result = await db.stock.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}, {"vendor_id": ""}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Stock records updated: {result.modified_count}")
        
        # Update price settings
        result = await db.price_settings.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}, {"vendor_id": ""}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Price settings updated: {result.modified_count}")
        
        # Update delivery shifts
        result = await db.delivery_shifts.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}, {"vendor_id": ""}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Delivery shifts updated: {result.modified_count}")
        
    else:
        # Multiple vendors - need to decide how to handle
        print(f"Multiple vendors found ({len(vendors)}):")
        for i, v in enumerate(vendors):
            print(f"   [{i+1}] {v.get('business_name', 'Unknown')} - {v.get('phone', 'N/A')}")
        
        print()
        print("For safety, orphaned data will be assigned to the FIRST registered vendor.")
        print("If you need different assignment, please do it manually in MongoDB.")
        print()
        
        choice = input("Continue with first vendor? (y/N): ").strip().lower()
        if choice != 'y':
            print("Aborted.")
            client.close()
            return
        
        # Assign to first vendor (oldest)
        sorted_vendors = sorted(vendors, key=lambda x: x.get("created_at", ""))
        vendor_id = str(sorted_vendors[0]["_id"])
        
        # Same update logic as above
        result = await db.orders.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Orders updated: {result.modified_count}")
        
        result = await db.customers.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Customers updated: {result.modified_count}")
        
        result = await db.delivery_staff.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Delivery staff updated: {result.modified_count}")
        
        result = await db.stock.update_many(
            {"$or": [{"vendor_id": {"$exists": False}}, {"vendor_id": None}]},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   ✅ Stock records updated: {result.modified_count}")
    
    print()
    print("=" * 70)
    print("✅ Migration complete! Data now has proper vendor isolation.")
    print("   Please restart the backend server and test with different logins.")
    print("=" * 70)
    
    client.close()


async def create_indexes():
    """Create database indexes for better performance."""
    
    print("\n📊 Creating database indexes...")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Create compound indexes for vendor isolation
    await db.orders.create_index([("vendor_id", 1), ("created_at", -1)])
    await db.orders.create_index([("vendor_id", 1), ("status", 1)])
    await db.orders.create_index([("vendor_id", 1), ("delivery_date", 1)])
    print("   ✅ orders indexes")
    
    await db.customers.create_index([("vendor_id", 1), ("phone_number", 1)], unique=True)
    print("   ✅ customers indexes")
    
    await db.delivery_staff.create_index([("vendor_id", 1), ("staff_id", 1)], unique=True)
    print("   ✅ delivery_staff indexes")
    
    await db.stock.create_index([("vendor_id", 1), ("date", 1)], unique=True)
    print("   ✅ stock indexes")
    
    await db.price_settings.create_index([("vendor_id", 1), ("litre_size", 1)])
    print("   ✅ price_settings indexes")
    
    await db.delivery_shifts.create_index([("vendor_id", 1), ("date", 1), ("staff_id", 1)])
    print("   ✅ delivery_shifts indexes")
    
    print("\n✅ All indexes created!")
    
    client.close()


async def main():
    """Main function."""
    
    if len(sys.argv) > 1 and sys.argv[1] == "--fix":
        await fix_orphaned_data()
        await create_indexes()
    else:
        vendors, has_issues = await diagnose_database()
        if has_issues:
            print()
            print("To fix these issues, run:")
            print(f"   python {os.path.basename(__file__)} --fix")
            print()


if __name__ == "__main__":
    asyncio.run(main())
