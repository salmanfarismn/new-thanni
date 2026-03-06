import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_startup():
    ROOT_DIR = Path(".")
    load_dotenv(ROOT_DIR / '.env')
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'thanni_canuuu')
    
    print(f"Connecting to {mongo_url}, DB: {db_name}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # 1. Test ping
    print("Pinging MongoDB...")
    await db.command("ping")
    print("Ping success")
    
    # 2. Test index creation (the suspected problematic line)
    print("Testing index creation for customer_states...")
    try:
        await db.customer_states.create_index([("updated_at", 1)], expireAfterSeconds=7200)
        print("Index created successfully")
    except Exception as e:
        print(f"Index creation failed: {e}")
        
    # 3. Try to import the app
    print("Importing app from server.py...")
    from server import app
    print("App imported successfully")

if __name__ == "__main__":
    import asyncio
    asyncio.run(debug_startup())
