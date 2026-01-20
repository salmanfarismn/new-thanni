import requests
import json
from datetime import date

BASE_URL = "http://localhost:8000/api"

def test_stock_increment():
    print("Testing stock increment logic...")
    
    # 1. Get current stock
    response = requests.get(f"{BASE_URL}/stock")
    if response.status_code != 200:
        print(f"Failed to get stock: {response.status_code}")
        return
    
    current_stock = response.json()
    initial_total = current_stock['total_stock']
    initial_available = current_stock['available_stock']
    print(f"Initial Stock: Total={initial_total}, Available={initial_available}")
    
    # 2. Increment stock by 10
    increment_amount = 10
    print(f"Incrementing stock by {increment_amount}...")
    update_response = requests.put(
        f"{BASE_URL}/stock",
        json={"increment": increment_amount}
    )
    
    if update_response.status_code != 200:
        print(f"Failed to update stock: {update_response.status_code}")
        print(update_response.text)
        return
    
    updated_stock = update_response.json()
    new_total = updated_stock['total_stock']
    new_available = updated_stock['available_stock']
    print(f"Updated Stock: Total={new_total}, Available={new_available}")
    
    # 3. Verify
    if new_total == initial_total + increment_amount and new_available == initial_available + increment_amount:
        print("✅ SUCCESS: Stock incremented correctly!")
    else:
        print("❌ FAILURE: Stock values are incorrect.")
        print(f"Expected Total: {initial_total + increment_amount}, Got: {new_total}")
        print(f"Expected Available: {initial_available + increment_amount}, Got: {new_available}")

if __name__ == "__main__":
    try:
        test_stock_increment()
    except Exception as e:
        print(f"An error occurred: {e}")
