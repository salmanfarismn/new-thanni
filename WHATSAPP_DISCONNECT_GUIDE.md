# WhatsApp Disconnect & Safety Guide

## Overview

HydroFlow uses **Baileys** (unofficial WhatsApp Web API) to integrate WhatsApp messaging. This guide explains how to safely connect, disconnect, and manage your WhatsApp integration.

## ⚠️ Critical Safety Warning

**DO NOT USE YOUR PERSONAL WHATSAPP NUMBER**

Using your personal WhatsApp number for API integrations can result in:
- Account flagging by WhatsApp
- Temporary or permanent bans
- Loss of access to your personal messages
- WhatsApp account suspension

**Always use:**
- A dedicated test phone number
- A separate business line
- A disposable SIM card for testing

## How Baileys Works

Baileys simulates a WhatsApp Web connection:
1. You scan a QR code (just like WhatsApp Web)
2. Your phone links the number to the server
3. Server maintains a session using stored credentials
4. All messages are routed through the server

## Disconnect Feature

### What Happens When You Disconnect?

1. **Logout Command Sent**
   - Server sends a logout signal to WhatsApp
   - Your linked device is removed from WhatsApp

2. **Session Deleted**
   - All session credentials are erased
   - `auth_info` folder is completely removed
   - No authentication data remains on server

3. **Messaging Stops**
   - All incoming message processing stops
   - No outgoing messages will be sent
   - WebSocket connection is closed

4. **Safe Mobile Access**
   - You can immediately log back into WhatsApp on your phone
   - No "another device is using your account" error
   - All your chats and data remain intact

### How to Disconnect

#### Via Dashboard

1. Go to **WhatsApp** tab in the dashboard
2. Click **"Disconnect WhatsApp"** button (red button)
3. A confirmation modal will appear
4. Review what will happen after disconnect
5. Click **"Disconnect"** to confirm
6. Wait for success message

#### What You'll See

- "WhatsApp disconnected successfully" toast notification
- Status changes from "Connected" to "Not Connected"
- You can now safely use WhatsApp on your mobile

### Confirmation Modal Details

Before disconnecting, you'll see:

**What happens after disconnect:**
- ✓ All WhatsApp messaging will stop
- ✓ Session credentials will be deleted
- ✓ You can safely log back into WhatsApp mobile
- ✓ You can reconnect later with the same or different number

## Reconnect Feature

### When to Reconnect

- After disconnecting for testing
- When switching to a different phone number
- If connection drops unexpectedly
- To start fresh with clean session

### How to Reconnect

1. Click **"Reconnect"** button
2. System clears any old session data
3. New QR code is generated
4. Scan QR code with WhatsApp mobile
5. Wait for "WhatsApp connected" confirmation

### Important Notes

- Old session credentials are never reused
- Each reconnection generates a fresh QR code
- You can use a different phone number when reconnecting
- Previous messages are NOT affected

## Safety Best Practices

### ✅ DO

- Use a dedicated test phone number
- Disconnect when not actively testing
- Keep your personal WhatsApp separate
- Test with low-volume scenarios first
- Monitor for WhatsApp rate limits
- Disconnect before sharing server access

### ❌ DON'T

- Use your personal WhatsApp number
- Keep connection active 24/7 during development
- Share QR codes with untrusted parties
- Connect multiple servers to same number
- Ignore WhatsApp's terms of service
- Use for spam or mass messaging

## Technical Details

### Backend Implementation

**Disconnect Endpoint**: `POST /api/whatsapp/disconnect`

```javascript
// WhatsApp service disconnect logic
app.post('/disconnect', async (req, res) => {
    // Send logout command
    await sock.logout();
    
    // Close socket
    sock.end();
    sock = null;
    
    // Delete auth_info folder
    fs.rmSync('auth_info', { recursive: true });
    
    return { success: true };
});
```

**Reconnect Endpoint**: `POST /api/whatsapp/reconnect`

```javascript
// WhatsApp service reconnect logic
app.post('/reconnect', async (req, res) => {
    // Clean up existing connection
    if (sock) sock.end();
    
    // Reinitialize WhatsApp
    await initWhatsApp();
    
    return { success: true };
});
```

### Frontend Implementation

```javascript
// Disconnect button with confirmation
const handleDisconnect = async () => {
    const response = await api.post('/whatsapp/disconnect');
    if (response.data.success) {
        toast.success('WhatsApp disconnected successfully!');
    }
};
```

## Warning Banners

### Dashboard Warning

A prominent warning banner appears on the WhatsApp page:

**⚠️ Important Safety Warning**
- DO NOT use your personal WhatsApp number
- Use a dedicated test number or business line
- Personal numbers may get flagged or banned
- You can disconnect safely at any time

### Disconnected State Warning

When not connected, additional warnings appear:

**Safety Reminders**
- Never use your personal WhatsApp number
- Use a separate test or business number
- You can disconnect at any time
- Disconnecting is safe and reversible

## Troubleshooting

### Issue: "Disconnect Failed"

**Solution:**
1. Check if WhatsApp service is running
2. Try manual disconnect: Stop WhatsApp service
3. Delete `/app/whatsapp-service/auth_info` folder manually
4. Restart WhatsApp service

```bash
# Manual cleanup
pkill -f "node index.js"
rm -rf /app/whatsapp-service/auth_info
cd /app/whatsapp-service && node index.js &
```

### Issue: "Can't Log Back into Mobile WhatsApp"

**Solution:**
1. Wait 30 seconds after disconnect
2. Force close WhatsApp mobile app
3. Reopen WhatsApp mobile app
4. You should be able to use it normally

### Issue: "Reconnect Shows Old QR Code"

**Solution:**
1. Refresh the page
2. Click "Reconnect" again
3. Wait for new QR code generation
4. QR codes expire after 60 seconds

### Issue: "Connection Keeps Dropping"

**Possible Causes:**
- WhatsApp detected automation
- Network issues
- Server resource constraints
- WhatsApp rate limiting

**Solution:**
1. Disconnect completely
2. Wait 1 hour
3. Use a different test number
4. Reduce message frequency

## Status Indicators

### Connected ✅
- Green banner: "WhatsApp Connected!"
- Shows connected phone number
- Disconnect button available
- Customer order flow active

### Disconnected ⚠️
- Yellow banner: "WhatsApp Not Connected"
- QR code displayed
- Reconnect button available
- No messages processed

### Error ❌
- Red banner: "Connection Error"
- Service may be down
- Check logs for details

## API Reference

### Get Status
```bash
GET /api/whatsapp/status

Response:
{
    "connected": true,
    "user": {
        "id": "919876543210",
        "name": "Test Number"
    }
}
```

### Disconnect
```bash
POST /api/whatsapp/disconnect

Response:
{
    "success": true,
    "message": "WhatsApp disconnected successfully. You can now log back into WhatsApp mobile safely."
}
```

### Reconnect
```bash
POST /api/whatsapp/reconnect

Response:
{
    "success": true,
    "message": "Reconnection initiated. Please scan the QR code."
}
```

## Security Considerations

1. **Session Storage**: Credentials are stored in `auth_info` folder
2. **Encryption**: Baileys uses WhatsApp's end-to-end encryption
3. **Access Control**: Only server has access to session
4. **Disconnect Safety**: Complete credential deletion
5. **No Cloud Storage**: All data stored locally

## Compliance

### WhatsApp Terms of Service

- Baileys is an **unofficial** WhatsApp API
- Not endorsed or supported by WhatsApp/Meta
- Use at your own risk
- Follow WhatsApp's automation policies
- Avoid spam or mass messaging
- Respect user privacy

### Recommendations

- Use for internal business operations only
- Don't build public-facing services
- Consider official WhatsApp Business API for production
- Keep message volume reasonable
- Implement rate limiting
- Monitor for policy changes

## Migration Path

### From Baileys to Official API

When ready for production:

1. Sign up for WhatsApp Business API
2. Get verified business account
3. Obtain API credentials
4. Update backend to use official SDK
5. Migrate phone numbers
6. Update webhook handling

## Support

For issues or questions:

**Check Logs:**
- WhatsApp Service: `cat /tmp/whatsapp-service.log`
- Backend: `tail -n 100 /var/log/supervisor/backend.*.log`

**Common Commands:**
```bash
# Check WhatsApp service status
ps aux | grep "node index.js"

# Restart WhatsApp service
pkill -f "node index.js"
cd /app/whatsapp-service && node index.js &

# Clean session manually
rm -rf /app/whatsapp-service/auth_info

# Test disconnect endpoint
curl -X POST http://localhost:3001/disconnect
```

## Conclusion

The disconnect feature ensures:
- ✅ Safe testing with dedicated numbers
- ✅ No impact on personal WhatsApp accounts
- ✅ Complete session cleanup
- ✅ Reversible and repeatable
- ✅ Clear user guidance and warnings

Always prioritize safety and use test numbers for development!
