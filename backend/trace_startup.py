"""Trace server startup to find crash cause."""
import traceback
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

try:
    from server import app
    print("[OK] Server module imported successfully")
except Exception as e:
    print(f"[FAIL] Import error: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    import uvicorn
    print("[OK] Starting uvicorn...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
except Exception as e:
    print(f"[FAIL] Uvicorn crash: {e}")
    traceback.print_exc()
    sys.exit(1)
