# ============================================
# ThanniCanuuu - Start All Services
# ============================================
# Usage: Right-click -> Run with PowerShell
#   OR:  powershell -ExecutionPolicy Bypass -File start_all.ps1
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  THANNI CANUUU - Service Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---- Check MongoDB ----
Write-Host "[1/4] Checking MongoDB..." -ForegroundColor Yellow
try {
    $mongo = Get-Process mongod -ErrorAction SilentlyContinue
    if ($mongo) {
        Write-Host "  MongoDB is running (PID: $($mongo.Id))" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: MongoDB (mongod) process not found!" -ForegroundColor Red
        Write-Host "  Please start MongoDB before running services." -ForegroundColor Red
        Write-Host "  Try: mongod --dbpath C:\data\db" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Could not check MongoDB status: $_" -ForegroundColor Red
}

# ---- Start Backend (FastAPI on :8000) ----
Write-Host ""
Write-Host "[2/4] Starting Backend API (port 8000)..." -ForegroundColor Yellow
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; Write-Host 'Starting FastAPI backend...' -ForegroundColor Green; python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload" -PassThru
Write-Host "  Backend started (PID: $($backendJob.Id))" -ForegroundColor Green

# ---- Start WhatsApp Service (Node.js on :3001) ----
Write-Host ""
Write-Host "[3/4] Starting WhatsApp Service (port 3001)..." -ForegroundColor Yellow
$whatsappJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\whatsapp-service'; Write-Host 'Starting WhatsApp service...' -ForegroundColor Green; node index.js" -PassThru
Write-Host "  WhatsApp service started (PID: $($whatsappJob.Id))" -ForegroundColor Green

# ---- Start Frontend (React on :3000) ----
Write-Host ""
Write-Host "[4/4] Starting Frontend (port 3000)..." -ForegroundColor Yellow
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\frontend'; Write-Host 'Starting React frontend...' -ForegroundColor Green; npm start" -PassThru
Write-Host "  Frontend started (PID: $($frontendJob.Id))" -ForegroundColor Green

# ---- Wait & Health Check ----
Write-Host ""
Write-Host "Waiting 8 seconds for services to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  HEALTH CHECK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Backend health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "  Backend API:      OK ($($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Backend API:      STARTING (may need a few more seconds)" -ForegroundColor Yellow
}

# WhatsApp health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "  WhatsApp Service: OK ($($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  WhatsApp Service: STARTING (may need a few more seconds)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SERVICE URLs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Frontend:   http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:    http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "  WhatsApp:   http://localhost:3001" -ForegroundColor White
Write-Host "  WA QR Code: http://localhost:3001/qr" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop services." -ForegroundColor Gray
Write-Host ""
