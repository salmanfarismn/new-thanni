# ThanniCanuuu - Running Services

**Last Updated**: 2026-01-30 at 13:48 IST

All services are now running locally with comprehensive sample data!

## 🚀 Active Services

### 1. **Backend API Server** ✅
- **URL**: http://localhost:5000
- **API Docs**: http://localhost:5000/docs
- **Status**: Running
- **Technology**: FastAPI + Python
- **Database**: MongoDB (localhost:27017)
- **Database Name**: thanni_canuuu

### 2. **Frontend Dashboard** ✅
- **URL**: http://localhost:3000
- **Status**: Running
- **Technology**: React + TailwindCSS
- **Features**: 
  - Dashboard with statistics
  - Orders management
  - Stock tracking
  - Delivery staff management
  - Settings

### 3. **WhatsApp Service** ✅
- **URL**: http://localhost:3001
- **Status**: Running
- **Technology**: Node.js + Baileys
- **Features**:
  - QR Code for WhatsApp connection
  - Message handling
  - Order notifications to delivery staff
  - Customer order flow

## 📊 Sample Data Loaded

The database has been populated with comprehensive sample data:

### Delivery Staff (4)
- **Active**: 3 delivery staff
- **Inactive**: 1 delivery staff
- DS001: Rajesh Kumar (2 active orders)
- DS002: Priya Sharma (1 active order)
- DS003: Amit Patel (0 active orders)
- DS004: Kavitha Nair (Inactive)

### Customers (8)
- Sunita Verma
- Vikram Singh
- Anita Desai
- Ravi Krishnan
- Meera Reddy
- Arjun Mehta
- Lakshmi Iyer
- Sanjay Gupta

### Orders
- **Today's Orders**: 8 orders
  - 4 delivered orders
  - 4 pending orders
- **Historical Orders**: Past 7 days of order data

### Stock
- **Today's Stock**: 100 total cans, 68 available
- **Historical Data**: 8 days of stock records

### Price Settings
- 20L can: ₹40
- 25L can: ₹50

### Delivery Shifts
- Today: 3 shifts assigned
- Tomorrow: 2 shifts assigned

## 🎯 Testing the Application

### Access the Dashboard
1. Open browser: http://localhost:3000
2. View statistics and analytics
3. Manage orders, stock, and delivery staff

### WhatsApp Integration
1. Check WhatsApp QR code at: http://localhost:3001/qr
2. Scan QR code with your WhatsApp
3. Test customer order flow
4. Test delivery staff notifications

### API Endpoints
Access API documentation at: http://localhost:5000/docs

Key endpoints:
- GET `/api/dashboard/stats` - Dashboard statistics
- GET `/api/orders` - List all orders
- GET `/api/stock/today` - Today's stock
- GET `/api/delivery-staff` - Delivery staff list
- POST `/api/orders` - Create new order

## 🛠 Managing Services

### Stop All Services
Press `Ctrl+C` in each terminal window

### Restart Services
```bash
# Backend
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 5000 --reload

# Frontend
cd frontend
npm start

# WhatsApp Service
cd whatsapp-service
npm start
```

### Clear and Reseed Database
```bash
cd backend
python seed_data.py
```

## 📱 Features Available

### Dashboard
- Real-time statistics
- Revenue metrics
- Stock availability
- Active orders count

### Orders Page
- View all orders (pending/delivered)
- Filter by status and date
- Order details with customer info
- Delivery staff assignment

### Stock Management
- Current stock levels
- Add new stock
- Historical stock data
- Stock usage analytics

### Delivery Staff
- Active/inactive staff
- Order assignments
- Performance tracking
- Contact information

### Shifts Management
- Schedule delivery shifts
- Morning/Evening/Full day shifts
- Staff availability

### Settings
- Price configuration (20L/25L)
- Company settings
- WhatsApp integration status

## 🔗 Important URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Main dashboard |
| Backend API | http://localhost:5000 | REST API |
| API Docs | http://localhost:5000/docs | Interactive API documentation |
| WhatsApp QR | http://localhost:3001/qr | Scan to connect WhatsApp |
| WhatsApp Service | http://localhost:3001 | WhatsApp bot service |

## ✅ Status Check

All services are running successfully! You can now:
- ✅ Access the dashboard at http://localhost:3000
- ✅ Use the WhatsApp bot by scanning QR code
- ✅ Test customer orders via WhatsApp
- ✅ Manage orders, stock, and delivery staff
- ✅ View analytics and reports

Enjoy testing ThanniCanuuu! 💧
