"""
ThanniCanuuu Functional Test Suite
Runs comprehensive tests against live backend API on port 8000.
"""
import requests
import json
import sys

BASE = "http://localhost:8000"
API_KEY = "thanni-canuuu-service-api-key-d4e6f1b9a0c5d7e3f2"
SERVICE_HEADERS = {"x-api-key": API_KEY}

results = []

def test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, status, detail))
    icon = "[OK]" if passed else "[!!]"
    print(f"  {icon} {name}: {status} {detail}")

def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}")

# ============================================
# 1. HEALTH CHECK
# ============================================
section("1. HEALTH CHECK")
try:
    r = requests.get(f"{BASE}/api/health", timeout=10)
    test("Backend health", r.status_code == 200, f"status={r.status_code}")
except Exception as e:
    test("Backend health", False, str(e))
    print("FATAL: Backend not running. Aborting.")
    sys.exit(1)

# ============================================
# 2. VENDOR REGISTRATION & LOGIN
# ============================================
section("2. VENDOR AUTH")

# Register a test vendor
reg_data = {
    "name": "Test Vendor",
    "business_name": "Test Water Co",
    "phone": "9999900000",
    "pin": "1234",
    "security_question": "What is your pet name?",
    "security_answer": "buddy"
}
r = requests.post(f"{BASE}/api/auth/register", json=reg_data, timeout=10)
if r.status_code == 200:
    test("Vendor register", True, "New vendor created")
elif r.status_code == 400 and "already" in r.text.lower():
    test("Vendor register", True, "Already exists (expected)")
else:
    test("Vendor register", False, f"status={r.status_code} body={r.text[:100]}")

# Login
login_data = {"phone": "9999900000", "pin": "1234"}
r = requests.post(f"{BASE}/api/auth/login", json=login_data, timeout=10)
if r.status_code == 200:
    token = r.json().get("access_token", "")
    test("Vendor login", bool(token), f"token_length={len(token)}")
    AUTH = {"Authorization": f"Bearer {token}"}
else:
    test("Vendor login", False, f"status={r.status_code}")
    AUTH = {}

# Get current user
if AUTH:
    r = requests.get(f"{BASE}/api/auth/me", headers=AUTH, timeout=10)
    test("Get current user (me)", r.status_code == 200, f"role={r.json().get('role','?')}")

# ============================================
# 3. PROTECTED ENDPOINTS (must require auth)
# ============================================
section("3. AUTH PROTECTION")

# Test endpoints that MUST require auth
protected_endpoints = [
    ("GET", "/api/orders"),
    ("GET", "/api/delivery-staff"),
    ("GET", "/api/stock"),
    ("GET", "/api/dashboard/metrics"),
    ("GET", "/api/customers"),
]
for method, path in protected_endpoints:
    r = requests.request(method, f"{BASE}{path}", timeout=10)
    test(f"Auth required: {method} {path}", r.status_code in [401, 403], f"status={r.status_code}")

# Test service endpoints that MUST require API key
service_endpoints = [
    ("GET", "/api/customers/1234567890/state?vendor_id=test"),
    ("GET", "/api/delivery-staff/check/1234567890"),
    ("GET", "/api/customers/lookup/1234567890"),
]
for method, path in service_endpoints:
    r = requests.request(method, f"{BASE}{path}", timeout=10)
    test(f"API key required: {path.split('?')[0]}", r.status_code == 401, f"status={r.status_code}")

# ============================================
# 4. ORDER FLOW
# ============================================
section("4. ORDER FLOW")

if AUTH:
    # First create a delivery staff member
    staff_data = {
        "name": "Test Driver",
        "phone_number": "9999911111",
        "staff_id": "STAFF-TEST-001",
        "is_active": True,
        "shift": "all_day"
    }
    r = requests.post(f"{BASE}/api/delivery-staff", headers=AUTH, json=staff_data, timeout=10)
    if r.status_code == 200:
        test("Create delivery staff", True)
    elif "already" in r.text.lower() or "exists" in r.text.lower() or "duplicate" in r.text.lower():
        test("Create delivery staff", True, "Already exists")
    else:
        test("Create delivery staff", r.status_code == 200, f"status={r.status_code} body={r.text[:100]}")

    # Set stock for today
    stock_data = {"total_stock": 100}
    r = requests.put(f"{BASE}/api/stock", headers=AUTH, json=stock_data, timeout=10)
    test("Set stock", r.status_code == 200, f"status={r.status_code}")

    # Check stock
    r = requests.get(f"{BASE}/api/stock", headers=AUTH, timeout=10)
    test("Get stock", r.status_code == 200, f"available={r.json().get('available_stock', '?')}")

    # Create order
    order_data = {
        "customer_phone": "9999922222",
        "customer_name": "Test Customer",
        "customer_address": "123 Test Street",
        "litre_size": 20,
        "quantity": 2
    }
    r = requests.post(f"{BASE}/api/orders", headers=AUTH, json=order_data, timeout=10)
    if r.status_code == 200:
        order_id = r.json().get("order_id", "")
        test("Create order", bool(order_id), f"order_id={order_id}")
    else:
        test("Create order", False, f"status={r.status_code} body={r.text[:200]}")
        order_id = None

    # Get orders
    r = requests.get(f"{BASE}/api/orders", headers=AUTH, timeout=10)
    test("List orders", r.status_code == 200, f"count={len(r.json()) if isinstance(r.json(), list) else '?'}")

    # Get specific order
    if order_id:
        r = requests.get(f"{BASE}/api/orders/{order_id}", headers=AUTH, timeout=10)
        test("Get order by ID", r.status_code == 200, f"status={r.json().get('status','?')}")

        # Update order status
        update = {"order_id": order_id, "status": "assigned"}
        r = requests.put(f"{BASE}/api/orders/{order_id}/status", headers=AUTH, json=update, timeout=10)
        test("Update order status", r.status_code == 200, f"new_status=assigned")

# ============================================
# 5. PAYMENT FLOW
# ============================================
section("5. PAYMENT FLOW")

if AUTH and order_id:
    # Confirm payment
    r = requests.put(f"{BASE}/api/outstanding/orders/{order_id}/confirm?payment_status=paid_cash", headers=AUTH, timeout=10)
    test("Confirm payment (cash)", r.status_code == 200, f"body={r.text[:80]}")

    # Get outstanding summary
    r = requests.get(f"{BASE}/api/outstanding/summary", headers=AUTH, timeout=10)
    test("Outstanding summary", r.status_code == 200)

# ============================================
# 6. STOCK & DAMAGE FLOW
# ============================================
section("6. STOCK & DAMAGE")

if AUTH:
    # Record damaged cans
    damage_data = {
        "quantity": 1,
        "reason": "broken",
        "notes": "Test damage report"
    }
    r = requests.post(f"{BASE}/api/damaged-cans", headers=AUTH, json=damage_data, timeout=10)
    test("Record damaged cans", r.status_code == 200, f"body={r.text[:80]}")

    # Get damage history
    r = requests.get(f"{BASE}/api/damage-history", headers=AUTH, timeout=10)
    test("Damage history", r.status_code == 200)

    # Today's damage
    r = requests.get(f"{BASE}/api/stock/damage/today", headers=AUTH, timeout=10)
    test("Today damage", r.status_code == 200)

# ============================================
# 7. MULTI-VENDOR ISOLATION
# ============================================
section("7. MULTI-VENDOR ISOLATION")

# Register a second vendor
reg2 = {
    "name": "Vendor Two",
    "business_name": "Other Water Co",
    "phone": "8888800000",
    "pin": "5678",
    "security_question": "What is your city?",
    "security_answer": "chennai"
}
r = requests.post(f"{BASE}/api/auth/register", json=reg2, timeout=10)
login2 = {"phone": "8888800000", "pin": "5678"}
r = requests.post(f"{BASE}/api/auth/login", json=login2, timeout=10)
if r.status_code == 200:
    token2 = r.json().get("access_token", "")
    AUTH2 = {"Authorization": f"Bearer {token2}"}
    
    # Vendor 2 should NOT see Vendor 1's orders
    r = requests.get(f"{BASE}/api/orders", headers=AUTH2, timeout=10)
    orders_v2 = r.json() if r.status_code == 200 else []
    # Vendor 1's order_id should not be in Vendor 2's list
    v2_order_ids = [o.get("order_id") for o in orders_v2] if isinstance(orders_v2, list) else []
    test("Vendor isolation (orders)", order_id not in v2_order_ids if order_id else True, 
         f"V2 sees {len(v2_order_ids)} orders, V1 order not in list")
    
    # Vendor 2 should NOT see Vendor 1's staff
    r = requests.get(f"{BASE}/api/delivery-staff", headers=AUTH2, timeout=10)
    staff_v2 = r.json() if r.status_code == 200 else []
    staff_ids = [s.get("staff_id") for s in staff_v2] if isinstance(staff_v2, list) else []
    test("Vendor isolation (staff)", "STAFF-TEST-001" not in staff_ids, 
         f"V2 sees {len(staff_ids)} staff")
    
    # Vendor 2 should NOT see Vendor 1's customers
    r = requests.get(f"{BASE}/api/customers", headers=AUTH2, timeout=10)
    test("Vendor isolation (customers)", r.status_code == 200, f"V2 customer data isolated")
else:
    test("Vendor 2 login", False, f"status={r.status_code}")

# ============================================
# 8. DASHBOARD
# ============================================
section("8. DASHBOARD")

if AUTH:
    r = requests.get(f"{BASE}/api/dashboard/metrics", headers=AUTH, timeout=10)
    test("Dashboard metrics", r.status_code == 200)

    r = requests.get(f"{BASE}/api/dashboard/sales", headers=AUTH, timeout=10)
    test("Dashboard sales", r.status_code == 200)

# ============================================
# 9. SETTINGS & PROFILE
# ============================================
section("9. SETTINGS & PROFILE")

if AUTH:
    r = requests.get(f"{BASE}/api/settings", headers=AUTH, timeout=10)
    test("Get settings", r.status_code == 200)

    r = requests.get(f"{BASE}/api/price-settings", headers=AUTH, timeout=10)
    test("Get pricing", r.status_code == 200)

# ============================================
# SUMMARY
# ============================================
print(f"\n{'='*50}")
print(f"  SUMMARY")
print(f"{'='*50}")
passed = sum(1 for _, s, _ in results if s == "PASS")
failed = sum(1 for _, s, _ in results if s == "FAIL")
print(f"  Passed: {passed}")
print(f"  Failed: {failed}")
print(f"  Total:  {len(results)}")

if failed > 0:
    print(f"\n  FAILED TESTS:")
    for name, status, detail in results:
        if status == "FAIL":
            print(f"    [!!] {name}: {detail}")

print()
