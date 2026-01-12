# HydroFlow - Water Can Delivery Management System

## Overview
HydroFlow is a WhatsApp-first web application designed for local water can delivery businesses. It replaces manual memory-based operations with an automated system that provides real-time clarity to business owners.

## Key Features

### 1. **WhatsApp Integration** (Primary Customer Interface)
- Customers order via WhatsApp messages
- Automated order confirmation and assignment
- Real-time stock availability checking
- Delivery staff notifications

### 2. **Owner Web Dashboard**
- Real-time metrics (orders, revenue, pending payments)
- Stock management
- Order tracking and status updates
- Delivery staff performance monitoring

### 3. **Automated Operations**
- Round-robin delivery staff assignment
- Automatic stock reduction on order placement
- Payment tracking (Cash/UPI)
- Order history and reporting

## System Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Customers     │◄────►│  WhatsApp Node   │◄────►│  FastAPI        │
│  (WhatsApp)     │      │    Service       │      │   Backend       │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                            │
                         ┌──────────────────┐              │
                         │   React          │◄─────────────┘
                         │   Dashboard      │
                         │   (Owner)        │
                         └──────────────────┘
```

## Getting Started

### Prerequisites
- Node.js (v16+)
- Python 3.11+
- MongoDB
- WhatsApp account

### Setup Instructions

#### 1. Backend Setup
The FastAPI backend is already running on `localhost:8001`

Delivery staff has been initialized:
- Rajesh Kumar (9876543210)
- Suresh Patel (9876543211)

#### 2. Frontend Setup
The React dashboard is accessible at the configured URL

#### 3. WhatsApp Service
The WhatsApp service is running on `localhost:3001`

To connect WhatsApp:
1. Open the dashboard
2. Go to "WhatsApp" tab
3. **IMPORTANT: Use a dedicated test number, NOT your personal WhatsApp**
4. Scan the QR code with your WhatsApp mobile app
5. WhatsApp → Settings → Linked Devices → Link a Device

To disconnect WhatsApp safely:
1. Go to "WhatsApp" tab
2. Click "Disconnect WhatsApp" button
3. Confirm the action
4. Your session will be cleared and you can log back into WhatsApp mobile safely

## Customer Order Flow

1. **Customer sends "Hi" or "Water" on WhatsApp**
   - Bot asks for name and address (first-time users)
   - Returns customers see available stock

2. **Bot shows available stock**
   - Customer replies with quantity (1, 2, 3, etc.)

3. **Order confirmed automatically**
   - Order ID generated
   - Delivery staff assigned (round-robin)
   - Staff receives WhatsApp notification
   - Customer gets confirmation with order details

4. **Delivery & Payment**
   - Owner tracks orders on dashboard
   - Marks order as delivered
   - Records payment (Cash/UPI)

## Dashboard Features

### Dashboard Page
- Today's key metrics
- Available stock with progress bar
- Total orders, delivered, pending
- Revenue and pending payments
- Orders grouped by delivery staff

### Orders Page
- Complete order list
- Filter by status (All/Pending/Delivered)
- Search by name, phone, order ID
- Quick actions: Mark delivered, Record payment

### Stock Management
- Set daily stock count
- Visual stock usage tracking
- Auto-updates on order placement

### WhatsApp Page
- Connection status
- QR code for linking
- Customer flow instructions
- Test setup guide

## Database Schema

### Collections

**customers**
```javascript
{
  phone_number: String,
  name: String,
  address: String,
  created_at: DateTime
}
```

**orders**
```javascript
{
  order_id: String,
  customer_phone: String,
  customer_name: String,
  customer_address: String,
  quantity: Number,
  status: String, // pending, delivered, cancelled
  delivery_staff_id: String,
  delivery_staff_name: String,
  payment_status: String, // pending, paid
  payment_method: String, // cash, upi
  amount: Number,
  created_at: DateTime,
  delivered_at: DateTime
}
```

**delivery_staff**
```javascript
{
  staff_id: String,
  name: String,
  phone_number: String,
  active_orders_count: Number
}
```

**stock**
```javascript
{
  date: String, // YYYY-MM-DD
  total_stock: Number,
  available_stock: Number,
  orders_count: Number,
  updated_at: DateTime
}
```

## API Endpoints

### WhatsApp
- `POST /api/whatsapp/message` - Handle incoming WhatsApp messages
- `GET /api/whatsapp/qr` - Get QR code for connection
- `GET /api/whatsapp/status` - Check WhatsApp connection status

### Dashboard
- `GET /api/dashboard/metrics` - Get today's metrics

### Orders
- `GET /api/orders` - List orders (with filters)
- `GET /api/orders/{order_id}` - Get order details
- `PUT /api/orders/{order_id}/status` - Update order status

### Stock
- `GET /api/stock` - Get today's stock
- `PUT /api/stock` - Update stock quantity

### Delivery Staff
- `GET /api/delivery-staff` - List all staff
- `POST /api/delivery-staff` - Add new staff

## Configuration

### Environment Variables

**Backend (.env)**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
WHATSAPP_SERVICE_URL=http://localhost:3001
```

**Frontend (.env)**
```
REACT_APP_BACKEND_URL=https://your-domain.com
```

## Business Rules

1. **Stock Management**
   - Default stock: 50 cans per day
   - Stock resets daily (manual)
   - Orders stop when stock = 0

2. **Pricing**
   - ₹50 per water can
   - Calculated automatically: quantity × 50

3. **Delivery Assignment**
   - Round-robin algorithm
   - Based on active_orders_count
   - Automatically balances workload

4. **Payment Tracking**
   - Marked during/after delivery
   - Options: Cash or UPI
   - Pending payments tracked separately

## WhatsApp Commands

### For Customers
- `hi` / `hello` / `water` - Start ordering
- `[number]` - Order quantity (1-10 cans)
- Share name and address (first time)

### For Delivery Staff (Future)
- Receive order assignments automatically
- Can update delivery status via WhatsApp

## Testing

### Test Customer Order
1. Send WhatsApp message to connected number: "hi"
2. Follow bot prompts
3. Check dashboard for new order

### Test Dashboard
1. Open dashboard
2. Set stock (Stock page)
3. Monitor orders (Dashboard/Orders page)
4. Update order status

## Troubleshooting

### WhatsApp Not Connecting
- Check if WhatsApp service is running: `ps aux | grep node`
- Check service logs: `cat /tmp/whatsapp-service.log`
- Restart service: Kill process and restart

### Orders Not Appearing
- Check backend logs: `tail -n 100 /var/log/supervisor/backend.*.log`
- Verify MongoDB connection
- Check if delivery staff exists in database

### Stock Issues
- Verify stock is set for today
- Check if stock was reduced on order placement
- Reset stock if needed from dashboard

## Future Enhancements
- SMS notifications as backup
- WhatsApp Business API (official) integration
- Multi-location support
- Analytics and reporting
- Customer loyalty programs
- Automated stock predictions

## Support
For issues or questions, check the logs:
- Backend: `/var/log/supervisor/backend.*.log`
- Frontend: Browser console
- WhatsApp: `/tmp/whatsapp-service.log`

## License
Proprietary - Internal Use Only
