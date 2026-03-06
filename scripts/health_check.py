"""
ThanniCanuuu Health Check Script
Run periodically (e.g., every 5 minutes via cron/task scheduler)
to monitor all services and alert on failures.
"""
import requests
import sys
from datetime import datetime

BACKEND_URL = "http://localhost:8000"
WHATSAPP_URL = "http://localhost:3001"
LOG_FILE = "health_check.log"

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except:
        pass

def check_service(name, url, timeout=10):
    try:
        r = requests.get(url, timeout=timeout)
        if r.status_code == 200:
            log(f"OK: {name} is healthy ({r.status_code})")
            return True
        else:
            log(f"WARN: {name} returned {r.status_code}")
            return False
    except requests.ConnectionError:
        log(f"FAIL: {name} is unreachable at {url}")
        return False
    except requests.Timeout:
        log(f"FAIL: {name} timed out after {timeout}s")
        return False
    except Exception as e:
        log(f"FAIL: {name} error: {e}")
        return False

def main():
    log("=" * 40)
    log("Health Check Starting")
    
    results = {}
    
    # Check backend
    results["backend"] = check_service("Backend API", f"{BACKEND_URL}/api/health")
    
    # Check WhatsApp service
    results["whatsapp"] = check_service("WhatsApp Service", f"{WHATSAPP_URL}/health")
    
    # Check database via backend health
    try:
        r = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        data = r.json()
        db_status = data.get("database", "unknown")
        results["database"] = db_status == "connected"
        log(f"{'OK' if results['database'] else 'FAIL'}: Database is {db_status}")
    except:
        results["database"] = False
        log("FAIL: Cannot check database status")
    
    # Summary
    all_healthy = all(results.values())
    log(f"Overall: {'ALL HEALTHY' if all_healthy else 'ISSUES DETECTED'}")
    log("=" * 40)
    
    if not all_healthy:
        sys.exit(1)
    
    return 0

if __name__ == "__main__":
    main()
