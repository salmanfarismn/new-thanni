#!/usr/bin/env python3
"""
Diagnostic script for WhatsApp QR code generation issues
"""
import asyncio
import httpx
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

WHATSAPP_SERVICE_URL = os.environ.get('WHATSAPP_SERVICE_URL', 'http://localhost:3001')
FASTAPI_URL = os.environ.get('REACT_APP_API_URL') or 'http://localhost:8000'
SERVICE_API_KEY = os.environ.get('SERVICE_API_KEY', '')

print("=" * 70)
print("WHATSAPP QR CODE DIAGNOSTICS")
print("=" * 70)
print(f"\n📍 Configuration:")
print(f"   WHATSAPP_SERVICE_URL: {WHATSAPP_SERVICE_URL}")
print(f"   FASTAPI_URL: {FASTAPI_URL}")
print(f"   SERVICE_API_KEY: {'✓ Set' if SERVICE_API_KEY else '✗ NOT SET'}")

async def test_whatsapp_service():
    """Test WhatsApp service health and QR endpoint"""
    print(f"\n🔍 Testing WhatsApp Service...")
    
    headers = {'x-api-key': SERVICE_API_KEY, 'Content-Type': 'application/json'}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Test health endpoint
        try:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/health", headers=headers)
            print(f"   ✓ Health Check: {response.status_code}")
            print(f"     Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ✗ Health Check Failed: {e}")
            return False
        
        # Test QR endpoint with test vendor
        test_vendor = "test-vendor-diagnostic"
        try:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/qr/{test_vendor}", headers=headers)
            print(f"\n   ✓ QR Endpoint Response: {response.status_code}")
            data = response.json()
            print(f"     Status: {data.get('status')}")
            print(f"     QR Code present: {'qr' in data and bool(data.get('qr'))}")
            print(f"     Message: {data.get('message', 'N/A')}")
            print(f"     Full Response: {data}")
        except Exception as e:
            print(f"   ✗ QR Endpoint Failed: {e}")
            return False
        
        # Test status endpoint
        try:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status/{test_vendor}", headers=headers)
            print(f"\n   ✓ Status Endpoint: {response.status_code}")
            print(f"     Response: {response.json()}")
        except Exception as e:
            print(f"   ✗ Status Endpoint Failed: {e}")
        
    return True

async def test_backend():
    """Test backend WhatsApp endpoints"""
    print(f"\n🔍 Testing Backend WhatsApp Endpoints...")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # You'll need to add auth headers here for actual backend testing
        try:
            response = await client.get(f"{FASTAPI_URL}/health")
            print(f"   ✓ Backend Health: {response.status_code}")
        except Exception as e:
            print(f"   ✗ Backend Health Failed: {e}")

async def main():
    await test_whatsapp_service()
    await test_backend()
    
    print("\n" + "=" * 70)
    print("RECOMMENDATIONS:")
    print("=" * 70)
    print("""
1. If WhatsApp service is unreachable:
   - Check if the service is running on Render.com
   - Review logs: Render dashboard → Select service → Logs
   - Ensure SERVICE_API_KEY environment variable is set correctly
   
2. If health check passes but QR endpoint is stuck at 'initializing':
   - The Baileys library is taking too long to initialize
   - SOLUTION A: Increase backend timeout (see fix below)
   - SOLUTION B: Restart the WhatsApp service on Render.com
   
3. Check WhatsApp service logs for errors:
   - Look for: "Initializing WhatsApp", "Connection:", "QR Code received"
   - If you see errors, the Baileys version might need updating
   
4. Browser console check:
   - Open DevTools (F12) → Network tab
   - Check requests to /whatsapp/qr
   - Look for timeout errors or 502/503 responses
""")

if __name__ == '__main__':
    asyncio.run(main())
