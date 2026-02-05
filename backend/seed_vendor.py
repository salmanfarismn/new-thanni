#!/usr/bin/env python3
"""
Seed script to create the initial vendor for Thanni Canuuu.
Run this after setting up the database to create the first vendor account.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from auth import hash_pin
from dotenv import load_dotenv

load_dotenv()

# Database configuration
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "thanni_canuuu")


async def seed_vendor():
    """Create the initial vendor account."""
    
    print("=" * 60)
    print("Thanni Canuuu - Vendor Seed Script")
    print("=" * 60)
    print()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Vendor details
    vendor_data = {
        "business_name": "Kumar Water Supply",
        "phone": "+919876543210",
        "pin": "1234"  # Will be hashed
    }
    
    print(f"Creating vendor: {vendor_data['business_name']}")
    print(f"Phone: {vendor_data['phone']}")
    print(f"PIN: {vendor_data['pin']} (will be hashed)")
    print()
    
    # Check if vendor already exists
    existing = await db.vendors.find_one({"phone": vendor_data["phone"]})
    
    if existing:
        print("⚠️  Vendor with this phone already exists!")
        print(f"   ID: {existing['_id']}")
        print(f"   Business: {existing['business_name']}")
        print()
        
        # Ask to update
        response = input("Do you want to reset the PIN to '1234'? (y/N): ").strip().lower()
        if response == 'y':
            new_hash = hash_pin(vendor_data["pin"])
            await db.vendors.update_one(
                {"_id": existing["_id"]},
                {"$set": {"pin_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            print("✅ PIN reset successfully!")
        else:
            print("No changes made.")
    else:
        # Create new vendor
        pin_hash = hash_pin(vendor_data["pin"])
        
        vendor_doc = {
            "business_name": vendor_data["business_name"],
            "phone": vendor_data["phone"],
            "pin_hash": pin_hash,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.vendors.insert_one(vendor_doc)
        vendor_id = str(result.inserted_id)
        
        print("✅ Vendor created successfully!")
        print(f"   Vendor ID: {vendor_id}")
        print()
        
        # Update existing data to belong to this vendor
        print("Updating existing data to belong to this vendor...")
        
        # Update orders
        orders_result = await db.orders.update_many(
            {"vendor_id": {"$exists": False}},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   - Orders updated: {orders_result.modified_count}")
        
        # Update customers
        customers_result = await db.customers.update_many(
            {"vendor_id": {"$exists": False}},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   - Customers updated: {customers_result.modified_count}")
        
        # Update delivery staff
        staff_result = await db.delivery_staff.update_many(
            {"vendor_id": {"$exists": False}},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   - Delivery staff updated: {staff_result.modified_count}")
        
        # Update stock
        stock_result = await db.stock.update_many(
            {"vendor_id": {"$exists": False}},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   - Stock records updated: {stock_result.modified_count}")
        
        # Update price settings
        prices_result = await db.price_settings.update_many(
            {"vendor_id": {"$exists": False}},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   - Price settings updated: {prices_result.modified_count}")
        
        # Update delivery shifts
        shifts_result = await db.delivery_shifts.update_many(
            {"vendor_id": {"$exists": False}},
            {"$set": {"vendor_id": vendor_id}}
        )
        print(f"   - Delivery shifts updated: {shifts_result.modified_count}")
    
    print()
    print("=" * 60)
    print("Login Credentials:")
    print("=" * 60)
    print(f"   Phone: {vendor_data['phone']}")
    print(f"   PIN:   {vendor_data['pin']}")
    print()
    print("Use these credentials to login to the dashboard!")
    print("=" * 60)
    
    # Close connection
    client.close()


async def create_indexes():
    """Create necessary database indexes."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("\nCreating database indexes...")
    
    # Vendors collection indexes
    await db.vendors.create_index("phone", unique=True)
    print("   - vendors.phone (unique)")
    
    # Sessions collection indexes
    await db.vendor_sessions.create_index("session_id", unique=True)
    await db.vendor_sessions.create_index("vendor_id")
    await db.vendor_sessions.create_index([("vendor_id", 1), ("is_revoked", 1)])
    print("   - vendor_sessions.session_id (unique)")
    print("   - vendor_sessions.vendor_id")
    print("   - vendor_sessions.vendor_id + is_revoked")
    
    # Orders collection indexes
    await db.orders.create_index("vendor_id")
    print("   - orders.vendor_id")
    
    # Customers collection indexes
    await db.customers.create_index("vendor_id")
    await db.customers.create_index([("vendor_id", 1), ("phone_number", 1)])
    print("   - customers.vendor_id")
    print("   - customers.vendor_id + phone_number")
    
    print("\n✅ All indexes created!")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_vendor())
    asyncio.run(create_indexes())
