# ThanniCanuuu Deployment Guide

## Prerequisites

- **Node.js** 18+ (for WhatsApp service and frontend build)
- **Python** 3.10+ (for backend API)
- **MongoDB** 6+ (database)
- **PM2** or **systemd** (process management, optional)

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd ThanniCanuuu

# Backend
cd backend
pip install -r requirements.txt

# WhatsApp Service
cd ../whatsapp-service
npm install

# Frontend
cd ../frontend
npm install
npm run build
```

---

## 2. Configure Environment

### Backend (.env)
```bash
cp backend/.env.production backend/.env
```
Then edit `backend/.env`:
- Set `CORS_ORIGINS` to your domain(s)
- Generate `SECRET_KEY`: `python -c "import secrets; print(secrets.token_hex(32))"`
- Generate `SERVICE_API_KEY`: `python -c "import secrets; print('thanni-prod-' + secrets.token_hex(20))"`
- Verify `MONGO_URL` points to your MongoDB instance

### WhatsApp Service (.env)
```bash
cp whatsapp-service/.env.production whatsapp-service/.env
```
Then edit `whatsapp-service/.env`:
- Set `SERVICE_API_KEY` to match the backend's key **exactly**

### Frontend
```bash
# Create frontend/.env with your backend URL
echo "REACT_APP_API_URL=https://api.yourdomain.com" > frontend/.env
```

---

## 3. Start Services

### Option A: Manual
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8000

# Terminal 2: WhatsApp
cd whatsapp-service
node index.js

# Terminal 3: Serve frontend
cd frontend
npx serve -s build -l 3000
```

### Option B: PM2 (Recommended)
```bash
npm install -g pm2

# Backend
pm2 start "python -m uvicorn server:app --host 0.0.0.0 --port 8000" --name backend --cwd ./backend

# WhatsApp
pm2 start index.js --name whatsapp --cwd ./whatsapp-service

# Frontend (static)
pm2 start "npx serve -s build -l 3000" --name frontend --cwd ./frontend

# Save
pm2 save
pm2 startup
```

### Option C: PowerShell (Development)
```powershell
.\start_all.ps1
```

---

## 4. Verify Deployment

```bash
# Health checks
python scripts/health_check.py

# Or manually:
curl http://localhost:8000/api/health
curl http://localhost:3001/health
curl http://localhost:3000
```

---

## 5. Monitoring

Run the health check script every 5 minutes:

### Linux (cron)
```bash
*/5 * * * * cd /path/to/ThanniCanuuu && python scripts/health_check.py >> health_check.log 2>&1
```

### Windows (Task Scheduler)
Create a scheduled task running `python scripts\health_check.py` every 5 minutes.

---

## 6. Security Checklist

- [ ] Secret keys rotated from development values
- [ ] SERVICE_API_KEY matches in both backend and whatsapp-service
- [ ] CORS_ORIGINS set to production domain(s) only
- [ ] MongoDB has authentication enabled
- [ ] HTTPS configured (reverse proxy: Nginx/Caddy)
- [ ] Rate limiting configured in production
- [ ] `.env` files excluded from git (check .gitignore)
- [ ] WhatsApp auth folders excluded from git

---

## Architecture

```
Frontend (React, port 3000)
    → Backend API (FastAPI, port 8000)
        → MongoDB (port 27017)
    → WhatsApp Service (Node.js, port 3001)
        → Backend API (via SERVICE_API_KEY)
```

All service-to-service calls use `x-api-key` header authentication.
All vendor-facing API calls use JWT Bearer token authentication.
