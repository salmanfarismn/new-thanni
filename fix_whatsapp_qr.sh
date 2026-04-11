#!/bin/bash
# WhatsApp QR Code Fix - Quick Action Checklist
# Run these commands to diagnose and fix the buffering issue

echo "========================================="
echo "WhatsApp QR Code - Quick Diagnostics"
echo "========================================="
echo ""

# Check if services are reachable
echo "1️⃣ Checking WhatsApp Service..."
WHATSAPP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://thanni-whatsapp.onrender.com/health)
if [ "$WHATSAPP_STATUS" = "200" ]; then
    echo "✅ WhatsApp Service: RUNNING"
else
    echo "❌ WhatsApp Service: NOT RESPONDING (Status: $WHATSAPP_STATUS)"
    echo "   ACTION: Restart service on Render.com dashboard"
fi
echo ""

echo "2️⃣ Checking Backend Service..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://new-thanni.onrender.com/health)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ Backend Service: RUNNING"
else
    echo "❌ Backend Service: NOT RESPONDING (Status: $BACKEND_STATUS)"
    echo "   ACTION: Restart service on Render.com dashboard"
fi
echo ""

echo "3️⃣ Checking Vendor Initialization State..."
VENDOR_DEBUG=$(curl -s https://thanni-whatsapp.onrender.com/debug/vendors 2>/dev/null || echo "ERROR")
if [ "$VENDOR_DEBUG" != "ERROR" ]; then
    echo "✅ Vendor Status:"
    echo "$VENDOR_DEBUG" | grep -o '"activeVendors":[0-9]*' || echo "   No active vendors"
else
    echo "❌ Could not fetch vendor debug info"
fi
echo ""

echo "========================================="
echo "QUICK FIXES TO TRY (in order):"
echo "========================================="
echo ""
echo "1. Clear Browser Cache:"
echo "   Windows: Press Ctrl+Shift+Delete"
echo "   Mac: Command+Shift+Delete"
echo ""
echo "2. Hard Reload Browser:"
echo "   Windows: Press Ctrl+F5"
echo "   Mac: Command+Shift+R"
echo ""
echo "3. Restart WhatsApp Service:"
echo "   - Go to https://dashboard.render.com"
echo "   - Select 'whatsapp-service'"
echo "   - Click 'Reboot' or 'Suspend' then 'Resume'"
echo "   - Wait 30 seconds and reload browser"
echo ""
echo "4. Check Browser Console (F12):"
echo "   - Look for /whatsapp/qr requests"
echo "   - Check if getting 200 response with 'initializing' status"
echo ""
echo "5. If stuck > 60 seconds:"
echo "   - Click 'Force Reset' button in WhatsApp page"
echo "   - This will wipe session and generate new QR"
echo ""
echo "========================================="
