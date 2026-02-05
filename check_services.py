#!/usr/bin/env python3
"""
Service Health Check Script for ThanniCanuuu
Checks if all services are running correctly on their actual ports
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
        ("Backend API (Orders)", "http://localhost:8000/api/orders"),
        ("Backend API (Health)", "http://localhost:8000/health"),
        ("Frontend", "http://localhost:3000"),
        ("WhatsApp Service Status", "http://localhost:3001/status"),
    ]
    
    results = []
    for name, url in services:
        result = check_service(name, url)
        results.append(result)
        print()
    
    print("=" * 60)
    if all(results):
        print("✅ All services are running correctly!")
        print()
        print("Services:")
        print("- Backend API: http://localhost:8000")
        print("- Frontend: http://localhost:3000")
        print("- WhatsApp Service: http://localhost:3001")
        sys.exit(0)
    else:
        print("❌ Some services are not running properly")
        print("\nPlease check the services and restart if needed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
