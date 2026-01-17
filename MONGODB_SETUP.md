# MongoDB Setup for Hydroflow

## Quick Start with MongoDB

The Hydroflow backend requires MongoDB to persist data. You have two options:

### Option 1: MongoDB Community Edition (Recommended for Production-like Demo)

1. **Download MongoDB**: Visit [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. **Install MongoDB Community Server** for Windows
3. **Start MongoDB**: The installer typically creates a Windows service that starts automatically
4. **Verify**: MongoDB should be running on `mongodb://localhost:27017`

### Option 2: Docker (Fastest for Demo)

If you have Docker installed:

```powershell
docker run -d -p 27017:27017 --name hydroflow-mongo mongo:latest
```

## After MongoDB is Running

Run the seed script to populate sample data:

```powershell
cd backend
.\venv\Scripts\python seed_data.py
```

Or use the API endpoint:

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/seed" -Method POST
```

## Seed Data Includes

- 3 Delivery Staff (Rajesh, Priya, Amit)
- 5 Customers with addresses
- 5 Orders (3 delivered, 2 pending)
- Today's stock (100 cans total, 75 available)
- Price settings for 20L and 25L cans
- Delivery shifts for today
