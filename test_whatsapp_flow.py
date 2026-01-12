import asyncio
import sys
import os
sys.path.append('/app/backend')

from server import handle_whatsapp_message, IncomingMessage

async def test_whatsapp_flow():
    print("🧪 Testing WhatsApp message flow...")
    
    # Test 1: Initial greeting
    print("\n1️⃣ Testing initial greeting...")
    message = IncomingMessage(
        phone_number="9999999999",
        message="hi",
        message_id="test1",
        timestamp=1234567890
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    # Test 2: Name registration
    print("\n2️⃣ Testing name registration...")
    message = IncomingMessage(
        phone_number="9999999999",
        message="My name is John Doe",
        message_id="test2",
        timestamp=1234567891
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    # Test 3: Address registration
    print("\n3️⃣ Testing address registration...")
    message = IncomingMessage(
        phone_number="9999999999",
        message="address: 123 Main Street, City",
        message_id="test3",
        timestamp=1234567892
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    # Test 4: Start order
    print("\n4️⃣ Testing order start...")
    message = IncomingMessage(
        phone_number="9999999999",
        message="order",
        message_id="test4",
        timestamp=1234567893
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    # Test 5: Select litre size
    print("\n5️⃣ Testing litre selection...")
    message = IncomingMessage(
        phone_number="9999999999",
        message="20",
        message_id="test5",
        timestamp=1234567894
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    # Test 6: Select quantity
    print("\n6️⃣ Testing quantity selection...")
    message = IncomingMessage(
        phone_number="9999999999",
        message="2",
        message_id="test6",
        timestamp=1234567895
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    print("\n✅ WhatsApp flow test completed!")

if __name__ == "__main__":
    asyncio.run(test_whatsapp_flow())