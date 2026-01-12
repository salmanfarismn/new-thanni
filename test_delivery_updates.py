import asyncio
import sys
import os
sys.path.append('/app/backend')

from server import handle_whatsapp_message, IncomingMessage

async def test_delivery_updates():
    print("🚚 Testing delivery staff status updates...")
    
    # Test delivery staff updating order status
    print("\n1️⃣ Testing 'DELIVERED' status update...")
    message = IncomingMessage(
        phone_number="9876543211",  # Suresh Patel's number
        message="delivered",
        message_id="delivery1",
        timestamp=1234567900
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    # Test payment status update
    print("\n2️⃣ Testing 'PAID CASH' status update...")
    message = IncomingMessage(
        phone_number="9876543211",  # Suresh Patel's number
        message="paid cash",
        message_id="delivery2",
        timestamp=1234567901
    )
    response = await handle_whatsapp_message(message)
    print(f"Response: {response.reply}")
    
    print("\n✅ Delivery status update test completed!")

if __name__ == "__main__":
    asyncio.run(test_delivery_updates())