import uvicorn
import traceback

if __name__ == "__main__":
    try:
        print("Starting uvicorn programmatically...")
        uvicorn.run("server:app", host="0.0.0.0", port=8000, log_level="debug")
    except Exception:
        print("Uvicorn crashed with exception:")
        traceback.print_exc()
