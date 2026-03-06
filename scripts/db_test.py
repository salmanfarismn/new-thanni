from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv('backend/.env')

mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.getenv('DB_NAME', 'thanni_canuuu')

print(f"Testing connection to: {mongo_url}")

try:
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
    client.server_info() # Force connection check
    print("✅ MongoDB Connection Successful!")
    
    db = client[db_name]
    vendors_count = db.vendors.count_documents({})
    users_count = db.users.count_documents({}) if 'users' in db.list_collection_names() else 0
    
    print(f"Stats:")
    print(f"  - Database: {db_name}")
    print(f"  - Vendors: {vendors_count}")
    print(f"  - Users/Agents: {users_count}")
    
except Exception as e:
    print(f"❌ MongoDB Connection FAILED: {e}")
