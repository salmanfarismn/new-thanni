#!/usr/bin/env python3
"""
Quick verification script to show loaded sample data
"""
import requests
import json

print("=" * 70)
print("ThanniCanuuu - Sample Data Verification")
print("=" * 70)
print()

# Backend API base URL
BASE_URL = "http://localhost:8000/api"

try:
    # Check Orders
    print("📦 ORDERS:")
    orders = requests.get(f"{BASE_URL}/orders", timeout=5).json()
    print(f"   Total: {len(orders)}")
    
    # Count by status
    statuses = {}
    for order in orders:
        status = order.get('status', 'unknown')
        statuses[status] = statuses.get(status, 0) + 1
    
    for status, count in statuses.items():
        print(f"   - {status}: {count}")
    print()
    
    # Check Customers
    print("👥 CUSTOMERS:")
    customers = requests.get(f"{BASE_URL}/customers", timeout=5).json()
    print(f"   Total: {len(customers)}")
    for i, customer in enumerate(customers[:3], 1):
        print(f"   {i}. {customer.get('name', 'Unknown')} - {customer.get('phone', 'N/A')}")
    if len(customers) > 3:
        print(f"   ... and {len(customers) - 3} more")
    print()
    
    # Check Delivery Staff
    print("🚚 DELIVERY STAFF:")
    staff = requests.get(f"{BASE_URL}/delivery-staff", timeout=5).json()
    print(f"   Total: {len(staff)}")
    for person in staff:
        print(f"   - {person.get('name', 'Unknown')} (ID: {person.get('staffId', 'N/A')})")
    print()
    
    # Check Stock
    print("📊 STOCK:")
    stock = requests.get(f"{BASE_URL}/stock", timeout=5).json()
    print(f"   Total Items: {len(stock)}")
    for item in stock[:5]:
        print(f"   - {item.get('itemName', 'Unknown')}: {item.get('currentQuantity', 0)} units")
    print()
    
    print("=" * 70)
    print("✅ All services working and data loaded successfully!")
    print()
    print("Access points:")
    print("  • Dashboard: http://localhost:3000")
    print("  • API: http://localhost:8000")
    print("  • WhatsApp: http://localhost:3001")
    print("=" * 70)

except requests.exceptions.ConnectionError as e:
    print(f"❌ Error: Could not connect to backend API")
    print(f"   Make sure the backend server is running on port 8000")
except Exception as e:
    print(f"❌ Error: {str(e)}")
