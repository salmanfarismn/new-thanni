import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os
import bcrypt

def hash_pin(pin: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pin.encode('utf-8'), salt)
    return hashed.decode('utf-8')

async def reset_jagan_pin():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.thanni_canuuu
    pin_hash = hash_pin("1234")
    result = await db.delivery_staff.update_one(
        {"phone_number": "9349295608"},
        {"$set": {"pin_hash": pin_hash}}
    )
    if result.matched_count:
        print("Jagan's PIN reset to 1234")
    else:
        # Try with +91
        result = await db.delivery_staff.update_one(
            {"phone_number": "919349295608"},
            {"$set": {"pin_hash": pin_hash}}
        )
        if result.matched_count:
             print("Jagan's PIN reset to 1234 (matched with 91)")
        else:
             print("Jagan not found")

if __name__ == "__main__":
    asyncio.run(reset_jagan_pin())
