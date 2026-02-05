# ThanniCanuuu - LocalEnvironment Setup Guide

## 🚀 All Services Are Running!

All three services have been started and are accessible on your local machine with comprehensive sample data loaded.

---

## 📊 Service Status

### 1. **Backend API Server** ✅ RUNNING
- **URL**: http://localhost:5000
- **API Documentation**: http://localhost:5000/docs
- **Health Check**: http://localhost:5000/health
- **Technology**: FastAPI + Python
- **Database**: MongoDB (localhost:27017)
- **Database Name**: thanni_canuuu

**Key API Endpoints**:
```
GET  /api/dashboard/metrics      - Dashboard statistics
GET  /api/orders                 - List all orders
GET  /api/stock                  - Today's stock
GET  /api/delivery-staff         - Delivery staff list
GET  /api/customers              - Customer list
GET  /api/price-settings         - Price configuration
POST /api/orders/create          - Create new order
```

### 2. **Frontend Dashboard** ✅ RUNNING
- **URL**: http://localhost:3000
- **Technology**: React + TailwindCSS
- **Features**:
  - 📈 Real-time Dashboard with statistics
  - 📦 Orders Management (view, filter, update)
  - 📊 Stock Tracking & Management
  - 👥 Delivery Staff Management
  - ⚙️ Settings (prices, company info)
  - 📱 WhatsApp Integration Status

### 3. **WhatsApp Service** ✅ RUNNING
- **URL**: http://localhost:3001
- **QR Code**: http://localhost:3001/qr
- **Status Check**: http://localhost:3001/status
- **Technology**: Node.js + Baileys
- **Features**:
  - QR Code for WhatsApp connection
  - Automated customer order flow
  - Delivery staff notifications
  - Message handling

---

## 📦 Sample Data Loaded

The database has been populated with realistic test data:

### 👥 Delivery Staff (4)
- **DS001**: Rajesh Kumar (Active, 2 orders)
- **DS002**: Priya Sharma (Active, 1 order)
- **DS003**: Amit Patel (Active, 0 orders)
- **DS004**: Kavitha Nair (Inactive)

### 👨‍👩‍👧‍👦 Customers (8)
- Sunita Verma - 919123456781
- Vikram Singh - 919123456782
- Anita Desai - 919123456783
- Ravi Krishnan - 919123456784
- Meera Reddy - 919123456785
- Arjun Mehta - 919123456786
- Lakshmi Iyer - 919123456787
- Sanjay Gupta - 919123456788

### 📋 Orders
- **Today**: 8 orders (4 delivered, 4 pending)
- **Historical**: Past 7 days of order data
- **Total Revenue**: Tracked across all orders

### 📦 Stock
- **Today's Stock**: 100 total cans, 68 available
- **Historical Data**: 8 days of stock records
- **Usage Tracking**: Daily stock consumption

### 💰 Price Settings
- **20L Can**: ₹40
- **25L Can**: ₹50

### 🗓️ Delivery Shifts
- **Today**: 3 shifts assigned
  - DS001: Morning shift
  - DS002: Evening shift
  - DS003: Full day shift
- **Tomorrow**: 2 shifts scheduled

---

## 🌐 Access the Application

### Open the Dashboard
1. **Open your browser** and navigate to: **http://localhost:3000**
2. You'll see the main dashboard with:
   - Total orders statistics
   - Revenue metrics
   - Stock availability
   - Active delivery staff
   - Recent orders

### Connect WhatsApp
1. Navigate to **Settings** in the dashboard
2. Click on **WhatsApp Integration**
3. Or directly visit: **http://localhost:3001/qr**
4. Scan the QR code with your WhatsApp app
5. Once connected, the bot will handle:
   - Customer order requests
   - Delivery staff notifications
   - Order confirmations

### Test API Directly
Access the interactive API documentation at:
**http://localhost:5000/docs**

Try these example API calls:
```powershell
# Get dashboard metrics
Invoke-WebRequest -Uri "http://localhost:5000/api/dashboard/metrics" -UseBasicParsing

# Get all orders
Invoke-WebRequest -Uri "http://localhost:5000/api/orders" -UseBasicParsing

# Get today's stock
Invoke-WebRequest -Uri "http://localhost:5000/api/stock" -UseBasicParsing

# Get delivery staff
Invoke-WebRequest -Uri "http://localhost:5000/api/delivery-staff" -UseBasicParsing
```

---

## 🧪 Testing Features

### Dashboard Page
- ✅ View total orders, delivered, pending counts
- ✅ See cans sold and revenue (total & today)
- ✅ Check stock availability
- ✅ Monitor active delivery staff

### Orders Page
- ✅ View all orders (pending/delivered)
- ✅ Filter by status and date
- ✅ See detailed order information
- ✅ Update order status
- ✅ Track payment status

### Stock Management
- ✅ View current stock levels
- ✅ Add new stock incrementally
- ✅ See historical stock data
- ✅ Track stock usage analytics

### Delivery Staff Management
- ✅ View active/inactive staff
- ✅ See order assignments
- ✅ Add new delivery staff
- ✅ Toggle staff active status
- ✅ Track performance

### Shifts Management
- ✅ Schedule delivery shifts (morning/evening/full day)
- ✅ Assign staff to shifts
- ✅ View today's and tomorrow's shifts

### Settings
- ✅ Configure prices (20L/25L cans)
- ✅ Update company name
- ✅ Check WhatsApp integration status
- ✅ Disconnect/Reconnect WhatsApp

---

## 🛠️ Managing Services

### Stop All Services
Press `Ctrl+C` in each terminal window to stop the respective service.

### Restart Individual Services

**Backend:**
```powershell
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 5000 --reload
```

**Frontend:**
```powershell
cd frontend
npm start
```

**WhatsApp Service:**
```powershell
cd whatsapp-service
npm start
```

### Reseed Database with Fresh Sample Data
If you want to reset and reload all sample data:
```powershell
cd backend
python seed_data.py
```

This will:
- Clear all existing data
- Create fresh delivery staff, customers, and orders
- Generate stock records for the past 7 days
- Set up shifts and price settings

---

## 📱 WhatsApp Order Flow Testing

To test the complete WhatsApp order flow:

1. **Connect WhatsApp** (scan QR code at http://localhost:3001/qr)
2. **Send a test message** from a customer number to your WhatsApp
3. The bot will:
   - Greet the customer
   - Ask for order details (size, quantity)
   - Check stock availability
   - Assign delivery staff
   - Create the order in the system
   - Send confirmation to customer
   - Notify assigned delivery staff

### Use the Test Workflow
You can also use the predefined test workflow:
```
/test-whatsapp-order-flow
```

---

## 🔗 Quick Links

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend Dashboard** | http://localhost:3000 | Main application interface |
| **Backend API** | http://localhost:5000 | REST API server |
| **API Docs** | http://localhost:5000/docs | Interactive API documentation |
| **API Health** | http://localhost:5000/health | Health check endpoint |
| **WhatsApp QR** | http://localhost:3001/qr | Scan to connect WhatsApp |
| **WhatsApp Status** | http://localhost:3001/status | Check connection status |

---

## ✅ Everything is Ready!

Your ThanniCanuuu application is now fully running locally with sample data. You can:

1. ✅ Access the dashboard at **http://localhost:3000**
2. ✅ Test the complete order management workflow
3. ✅ Manage delivery staff, stock, and shifts
4. ✅ Connect WhatsApp for automated ordering
5. ✅ View analytics and reports
6. ✅ Export data (orders, customers, stock)

---

## 💡 Tips

- **First Time Setup**: If WhatsApp QR doesn't appear, wait a few seconds and refresh
- **Database**: MongoDB must be running on localhost:27017
- **Sample Data**: Use the seed script anytime to reset to fresh sample data
- **Testing**: Try creating new orders, updating stock, managing delivery staff
- **Logs**: Check terminal windows for real-time logs from each service

---

## 🐛 Troubleshooting

**Frontend not loading?**
- Check if port 3000 is available
- Ensure all dependencies are installed: `npm install`

**Backend API errors?**
- Verify MongoDB is running
- Check .env file has correct configuration
- Ensure Python dependencies are installed

**WhatsApp not connecting?**
- Check if port 3001 is available
- Ensure whatsapp-service dependencies are installed
- Try restarting the service

---

Enjoy testing **ThanniCanuuu**! 💧🚀
