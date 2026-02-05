#!/usr/bin/env python3
"""
Service Health Check Script
Checks if all ThanniCanuuu services are running correctly
"""
import requests
import sys

def check_service(name, url, expected_status=200):
    """Check if a service is responding"""
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == expected_status or response.status_code == 200:
            print(f"✅ {name}: OK (Status: {response.status_code})")
            return True
        else:
            print(f"⚠️ {name}: Unexpected status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ {name}: Connection refused - Service not running")
        return False
    except requests.exceptions.Timeout:
        print(f"❌ {name}: Timeout - Service not responding")
        return False
    except Exception as e:
        print(f"❌ {name}: Error - {str(e)}")
        return False

def main():
    print("=" * 60)
    print("ThanniCanuuu Service Health Check")
    print("=" * 60)
    print()
    
    services = [
        ("Backend API", "http://localhost:5000/api/orders"),
        ("Frontend", "http://localhost:3000"),
        ("WhatsApp Service", "http://localhost:3001/status"),
    ]
    
    results = []
    for name, url in services:
        result = check_service(name, url)
        results.append(result)
        print()
    
    print("=" * 60)
    if all(results):
        print("✅ All services are running correctly!")
        sys.exit(0)
    else:
        print("❌ Some services are not running properly")
        print("\nPlease check:")
        print("1. Backend: python -m uvicorn server:app --host 0.0.0.0 --port 5000 --reload")
        print("2. Frontend: npm start (in frontend directory)")
        print("3. WhatsApp: npm start (in whatsapp-service directory)")
        sys.exit(1)

if __name__ == "__main__":
    main()
