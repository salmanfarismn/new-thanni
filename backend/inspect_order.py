import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

def inspect_order():
    mongo_url = os.getenv('MONGO_URL')
    db_name = os.getenv('DB_NAME')
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    order_id = "ORD20260213200444001"
    order = db.orders.find_one({"order_id": order_id})
    
    if order:
        print(f"Order: {order_id}")
        for k, v in order.items():
            print(f"{k}: {v} ({type(v)})")
    else:
        print("Order not found")

if __name__ == "__main__":
    inspect_order()
