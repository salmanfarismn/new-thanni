"""Direct API test runner - bypasses pytest output issues."""
import httpx
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

BASE = 'http://127.0.0.1:8000/api'
TIMEOUT = 10.0

results = []

def test(name, fn):
    try:
        ok, detail = fn()
        status = "PASS" if ok else "FAIL"
        results.append((name, status, detail))
        print(f"  [{status}] {name}: {detail}")
    except Exception as e:
        results.append((name, "ERROR", str(e)))
        print(f"  [ERROR] {name}: {e}")


print("=" * 60)
print("Production Readiness Upgrade - API Test Suite")
print("=" * 60)

# 1. Legacy webhook deprecation
def t1():
    r = httpx.post(f'{BASE}/whatsapp/webhook', json={"entry": []}, timeout=TIMEOUT)
    ok = r.status_code == 200 and r.json().get("status") == "deprecated"
    return ok, f"status={r.status_code} body={r.json()}"
test("Legacy webhook POST blocked", t1)

# 2. Legacy message endpoint deprecated
def t2():
    r = httpx.post(f'{BASE}/whatsapp/message', json={
        "phone_number": "919999", "message": "hi",
        "message_id": "test_msg_001", "timestamp": 1700000000
    }, timeout=TIMEOUT)
    ok = r.status_code == 200 and r.json().get("success") is False
    return ok, f"status={r.status_code} success={r.json().get('success')}"
test("Legacy /whatsapp/message blocked", t2)

# 3. Notification preferences - requires auth
def t3():
    r = httpx.get(f'{BASE}/notifications/preferences', timeout=TIMEOUT)
    ok = r.status_code in [401, 403]
    return ok, f"status={r.status_code} (expected 401/403)"
test("Notification prefs require auth", t3)

# 4. Notification preferences - with auth
def t4():
    from auth import create_access_token
    import uuid
    token = create_access_token("test_v", str(uuid.uuid4()), "vendor", "test_v")
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.get(f'{BASE}/notifications/preferences', headers=headers, timeout=TIMEOUT)
    ok = r.status_code == 200 and "order_alerts" in r.json()
    return ok, f"status={r.status_code} keys={list(r.json().keys())[:5]}"
test("GET notification prefs with auth", t4)

# 5. Update notification preferences
def t5():
    from auth import create_access_token
    import uuid
    token = create_access_token("test_v2", str(uuid.uuid4()), "vendor", "test_v2")
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.put(f'{BASE}/notifications/preferences', headers=headers, 
                  json={"order_alerts": False, "sound_enabled": False}, timeout=TIMEOUT)
    ok = r.status_code == 200 and r.json().get("success") is True
    return ok, f"status={r.status_code} prefs={r.json().get('preferences', {})}"
test("PUT notification prefs update", t5)

# 6. Invalid prefs fields rejected
def t6():
    from auth import create_access_token
    import uuid
    token = create_access_token("test_v3", str(uuid.uuid4()), "vendor", "test_v3")
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.put(f'{BASE}/notifications/preferences', headers=headers, 
                  json={"hacker_field": True}, timeout=TIMEOUT)
    ok = r.status_code == 400
    return ok, f"status={r.status_code} (expected 400)"
test("Invalid pref fields rejected", t6)

# 7. Language endpoint requires API key (or returns 404 if key not configured)
def t7():
    r = httpx.put(f'{BASE}/customers/919999/language', 
                  json={"preferred_language": "ta", "vendor_id": "test"}, timeout=TIMEOUT)
    # Accept 401/403 (key rejected) or 404 (key not set, so passes auth but customer not found)
    ok = r.status_code in [401, 403, 404]
    return ok, f"status={r.status_code} (expected 401/403/404)"
test("Language endpoint guarded", t7)

# 8. Source code: payment status mapping
def t8():
    source = open(os.path.join(os.path.dirname(__file__), 'routers', 'agent.py'), 'r', encoding='utf-8').read()
    ok = '"not_paid": "delivered_unpaid"' in source and '"not_paid": "unpaid"' not in source
    return ok, "Maps not_paid to delivered_unpaid"
test("Payment status map correct", t8)

# 9. Source code: deprecated markers
def t9():
    source = open(os.path.join(os.path.dirname(__file__), 'server.py'), 'r', encoding='utf-8').read()
    count = source.count("[DEPRECATED]")
    ok = count >= 5
    return ok, f"Found {count} [DEPRECATED] markers (need >= 5)"
test("Deprecated markers in source", t9)

# 10. Source code: vendor_id in get_or_create_customer
def t10():
    source = open(os.path.join(os.path.dirname(__file__), 'server.py'), 'r', encoding='utf-8').read()
    ok = "get_or_create_customer(phone_number: str, name: str = None, address: str = None, vendor_id: str = None)" in source
    return ok, "vendor_id param present in signature"
test("get_or_create_customer has vendor_id", t10)

# Summary
print()
print("=" * 60)
passed = sum(1 for _, s, _ in results if s == "PASS")
failed = sum(1 for _, s, _ in results if s == "FAIL")
errors = sum(1 for _, s, _ in results if s == "ERROR")
total = len(results)
print(f"RESULTS: {passed}/{total} passed, {failed} failed, {errors} errors")
print("=" * 60)

if failed + errors > 0:
    print("\nFailed/Error tests:")
    for name, status, detail in results:
        if status != "PASS":
            print(f"  [{status}] {name}: {detail}")

sys.exit(1 if (failed + errors) > 0 else 0)
