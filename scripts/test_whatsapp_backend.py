#!/usr/bin/env python3
"""Test WhatsApp backend connectivity"""
import requests
import json

def test_endpoint(name, url, method='GET', data=None):
    try:
        if method == 'GET':
            response = requests.get(url, timeout=5)
        else:
            response = requests.post(url, json=data, timeout=5)
        
        print(f"\n{name}:")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
        return True
    except Exception as e:
        print(f"\n{name}:")
        print(f"  Error: {str(e)}")
        return False

print("=" * 60)
print("WhatsApp Backend Connectivity Test")
print("=" * 60)

# Test WhatsApp service status
test_endpoint("WhatsApp Service Status", "http://localhost:3001/status")

# Test backend price endpoint
test_endpoint("Product Prices", "http://localhost:5000/api/products/prices")

# Test inventory check
test_endpoint("Inventory Check", "http://localhost:5000/api/inventory/check", 
              method='POST', data={"quantity": 5})

# Test customer lookup (sample phone)
test_endpoint("Customer Lookup", "http://localhost:5000/api/customers/919123456781")

# Test delivery staff
test_endpoint("Delivery Staff List", "http://localhost:5000/api/delivery-staff")

print("\n" + "=" * 60)
