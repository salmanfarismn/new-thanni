"""
Vendor Database Information Script
Shows all registered vendors and their associated data counts
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env')

async def show_vendor_info():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("=" * 70)
    print("THANNI CANUUU - VENDOR DATABASE REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # Get all vendors
    vendors = await db.vendors.find({}).to_list(100)
    
    print(f"\nTotal Registered Vendors: {len(vendors)}")
    print("-" * 70)
    
    for i, v in enumerate(vendors, 1):
        vendor_id = str(v['_id'])
        name = v.get('name', 'N/A')
        business = v.get('business_name', 'N/A')
        phone = v.get('phone', 'N/A')
        is_active = v.get('is_active', True)
        created = v.get('created_at', 'N/A')
        
        # Count data for this vendor
        orders = await db.orders.count_documents({"vendor_id": vendor_id})
        customers = await db.customers.count_documents({"vendor_id": vendor_id})
        staff = await db.delivery_staff.count_documents({"vendor_id": vendor_id})
        
        # Count active sessions
        sessions = await db.sessions.count_documents({"vendor_id": vendor_id, "is_valid": True})
        
        print(f"\n[VENDOR {i}]")
        print(f"  Vendor ID    : {vendor_id}")
        print(f"  Name         : {name}")
        print(f"  Business     : {business}")
        print(f"  Phone        : {phone}")
        print(f"  Active       : {'Yes' if is_active else 'No'}")
        print(f"  Created      : {created}")
        print(f"  Active Logins: {sessions}")
        print(f"  Data:")
        print(f"    - Orders   : {orders}")
        print(f"    - Customers: {customers}")
        print(f"    - Staff    : {staff}")
    
    # Show sessions breakdown
    print("\n" + "=" * 70)
    print("ACTIVE LOGIN SESSIONS")
    print("-" * 70)
    
    active_sessions = await db.sessions.find({"is_valid": True}).to_list(100)
    
    if not active_sessions:
        print("No active sessions found.")
    else:
        for s in active_sessions:
            vendor = await db.vendors.find_one({"_id": s.get('vendor_id')})
            vendor_name = vendor.get('name', 'Unknown') if vendor else 'Unknown'
            
            print(f"\n  Session ID   : {str(s.get('_id', 'N/A'))[:16]}...")
            print(f"  Vendor       : {vendor_name}")
            print(f"  Device       : {s.get('device_name', 'Unknown')}")
            print(f"  Created      : {s.get('created_at', 'N/A')}")
            print(f"  Last Active  : {s.get('last_active', 'N/A')}")
            print(f"  Expires      : {s.get('expires_at', 'N/A')}")
    
    print("\n" + "=" * 70)
    client.close()

if __name__ == "__main__":
    asyncio.run(show_vendor_info())
