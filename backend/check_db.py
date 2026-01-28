"""
Quick script to verify database contents
"""
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from dotenv import load_dotenv

async def check_db():
    load_dotenv('.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("=== Database Contents ===\n")
    
    orders_count = await db.orders.count_documents({})
    print(f"📦 Total Orders: {orders_count}")
    
    customers_count = await db.customers.count_documents({})
    print(f"👥 Total Customers: {customers_count}")
    
    staff_count = await db.delivery_staff.count_documents({})
    print(f"🚚 Delivery Staff: {staff_count}")
    
    stock_count = await db.stock.count_documents({})
    print(f"📊 Stock Records: {stock_count}")
    
    # Show sample orders
    print("\n=== Sample Orders ===")
    orders = await db.orders.find({}).sort("created_at", -1).limit(5).to_list(5)
    for order in orders:
        print(f"  - {order['order_id']}: {order['customer_name']} ({order['status']}) - {order['created_at'][:10]}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())
