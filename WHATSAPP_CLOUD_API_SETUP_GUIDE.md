# WhatsApp Business Cloud API Setup Guide

## Complete Step-by-Step Guide to Get Your Credentials

### Overview
This guide will help you set up WhatsApp Business Cloud API from scratch. The process includes:
1. Creating a Meta Business Account
2. Creating a WhatsApp Business App
3. Getting Phone Number ID and Access Token
4. Setting up webhook
5. Testing with Meta's test number

**Time Required:** 30-60 minutes for initial setup, 1-5 days for business verification

---

## Step 1: Create Meta Business Account

### 1.1 Go to Meta for Developers
- Visit: https://developers.facebook.com/
- Click **"Get Started"** (top right)
- Log in with your Facebook account (or create one)

### 1.2 Create Business Account
- Click **"My Apps"** (top right)
- Select **"Create App"**
- Choose **"Business"** type
- Click **"Next"**

### 1.3 App Details
- **App Name**: "HydroFlow Water Delivery" (or your business name)
- **App Contact Email**: Your business email
- **Business Account**: Create new or select existing
- Click **"Create App"**

---

## Step 2: Add WhatsApp Product

### 2.1 Find WhatsApp in Products
- In your app dashboard, scroll down to **"Add Products to Your App"**
- Find **"WhatsApp"**
- Click **"Set Up"**

### 2.2 WhatsApp Setup Wizard
You'll see the WhatsApp Business Platform setup screen with:
- A test phone number (for receiving messages)
- API credentials
- Quick start guide

**IMPORTANT**: Don't close this page yet!

---

## Step 3: Get Your Credentials

### 3.1 Temporary Access Token (For Testing)
On the WhatsApp setup page, you'll see:
- **Phone Number ID**: Copy this (looks like: `123456789012345`)
- **WhatsApp Business Account ID**: Copy this (looks like: `123456789012345`)
- **Temporary Access Token**: Click **"Copy"** (valid for 24 hours)

**Save these in a secure location!**

### 3.2 Test Phone Number
Meta provides a test number for free testing:
- **Test Number**: Displayed on setup page (looks like: `+1 555-XXX-XXXX`)
- **Test Recipient**: Your personal WhatsApp number (for receiving test messages)
- You can add up to 5 phone numbers for testing

**Add Your Phone Number as Test Recipient:**
1. Click **"Add Phone Number"** under "To"
2. Enter your WhatsApp number with country code
3. Click **"Next"**
4. You'll receive a verification code on WhatsApp
5. Enter the code and verify

---

## Step 4: Generate Permanent Access Token

### 4.1 Why Permanent Token?
The temporary token expires in 24 hours. For production, you need a permanent token.

### 4.2 Create System User
1. Go to **Meta Business Suite**: https://business.facebook.com/
2. Click **"Business Settings"** (bottom left)
3. Go to **"Users" → "System Users"**
4. Click **"Add"**
5. **Name**: "HydroFlow API"
6. **Role**: Admin
7. Click **"Create System User"**

### 4.3 Assign Assets
1. Click **"Add Assets"**
2. Select **"Apps"**
3. Choose your "HydroFlow" app
4. Check **"Manage App"**
5. Click **"Save Changes"**

1. Again click **"Add Assets"**
2. Select **"WhatsApp Accounts"**
3. Choose your WhatsApp Business Account
4. Check **"Manage WhatsApp Account"**
5. Click **"Save Changes"**

### 4.4 Generate Token
1. Click **"Generate New Token"**
2. **App**: Select "HydroFlow"
3. **Permissions**: Check these:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. **Token Duration**: Choose "Never Expire" (or custom)
5. Click **"Generate Token"**
6. **COPY THE TOKEN IMMEDIATELY** (you can't see it again)
7. Save it securely (like password manager)

---

## Step 5: Set Up Webhook

### 5.1 What is a Webhook?
A webhook is a URL where WhatsApp sends incoming messages. Your server needs to be publicly accessible.

### 5.2 Local Testing with ngrok (Development)

**Install ngrok:**
```bash
# Download from https://ngrok.com/download
# Or use package manager:
brew install ngrok  # Mac
choco install ngrok # Windows
```

**Start your FastAPI server:**
```bash
cd /app/backend
python -m uvicorn server:app --reload --port 8001
```

**Expose to internet:**
```bash
ngrok http 8001
```

You'll see:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:8001
```

**Copy the HTTPS URL** (looks like: `https://abc123.ngrok.io`)

### 5.3 Configure Webhook in Meta

1. Go back to your **App Dashboard**
2. Click **WhatsApp → Configuration** (left sidebar)
3. Find **"Webhook"** section
4. Click **"Edit"**

**Webhook Settings:**
- **Callback URL**: `https://abc123.ngrok.io/api/whatsapp/webhook`
- **Verify Token**: Create a random string (e.g., "my_secure_verify_token_123")
  - Save this token - you'll need it in your .env file
- Click **"Verify and Save"**

**If verification succeeds**, you'll see a green checkmark ✓

**Subscribe to Webhook Fields:**
- Check **"messages"**
- Check **"message_status"** (optional, for delivery status)
- Click **"Save"**

---

## Step 6: Test the Integration

### 6.1 Add Your .env Variables

Create `/app/backend/.env`:
```
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token_here
WHATSAPP_VERIFY_TOKEN=my_secure_verify_token_123
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_API_VERSION=v21.0
```

### 6.2 Send Test Message

From Meta Dashboard:
1. Go to **WhatsApp → API Setup**
2. Under "Send and receive messages", find **"To"**
3. Enter your verified test phone number
4. Click **"Send Message"**
5. You should receive "Hello World" on WhatsApp

### 6.3 Receive Test Message

1. Send a message from your phone to the test WhatsApp number
2. Check your server logs - you should see the incoming webhook
3. Your server should respond automatically

---

## Step 7: Business Verification (For Production)

### 7.1 Why Verify?
- Test numbers have limits (1000 messages/day, 50 unique recipients)
- To use your own phone number, you need business verification

### 7.2 Verification Process
1. Go to **Meta Business Suite** → **Business Settings**
2. Click **"Security Center"**
3. Click **"Start Verification"**
4. Provide:
   - Business legal name
   - Business address
   - Business website
   - Business documents (registration certificate, utility bill, etc.)
5. Submit for review

**Timeline:** 1-5 business days

### 7.3 Add Your Own Phone Number (After Verification)

1. Go to **WhatsApp → Phone Numbers**
2. Click **"Add Phone Number"**
3. Choose:
   - **Register new number**: Get a new WhatsApp number
   - **Migrate existing**: Move existing WhatsApp Business number
4. Follow the verification process

---

## Step 8: Production Deployment

### 8.1 Replace ngrok with Production URL

Once you deploy to production:
1. Update webhook URL to your domain: `https://yourdomain.com/api/whatsapp/webhook`
2. Re-verify webhook in Meta Dashboard
3. Test with production number

### 8.2 Security Checklist
- ✅ Store tokens in environment variables (never in code)
- ✅ Use HTTPS (required by WhatsApp)
- ✅ Validate webhook signatures (optional but recommended)
- ✅ Implement rate limiting
- ✅ Log all API calls for debugging
- ✅ Set up monitoring and alerts

---

## Common Issues & Solutions

### Issue 1: Webhook Verification Fails
**Cause**: Server not responding correctly
**Solution**:
- Check server is running
- Check ngrok is active
- Check verify token matches exactly
- Check endpoint is `/api/whatsapp/webhook`

### Issue 2: Messages Not Being Received
**Cause**: Webhook not subscribed to "messages" field
**Solution**:
- Go to WhatsApp → Configuration
- Subscribe to "messages" field
- Click Save

### Issue 3: Can't Send Messages
**Cause**: Invalid access token or phone number ID
**Solution**:
- Regenerate access token
- Check Phone Number ID is correct
- Check number is not expired (test numbers expire)

### Issue 4: "Message Template Required"
**Cause**: Trying to send first message without template
**Solution**:
- For first message to a user, you must use approved template
- Or user must message you first
- After 24 hours, templates required again

---

## Credentials Summary

At the end of setup, you should have:

```
✅ Phone Number ID: 123456789012345
✅ Access Token: EAAxxxxxxxxxxxxx (permanent)
✅ Verify Token: my_secure_verify_token_123
✅ WABA ID: 123456789012345
✅ App ID: 123456789012345
✅ App Secret: xxxxxxxxxxxxx
✅ Test Phone Number: +1 555-XXX-XXXX
✅ Webhook URL: https://abc123.ngrok.io/api/whatsapp/webhook
```

---

## Next Steps

1. ✅ Complete this setup guide
2. ✅ Save all credentials securely
3. ✅ Test sending and receiving messages
4. 🔄 Replace Baileys code with Cloud API
5. 🔄 Implement interactive buttons
6. 🔄 Test complete order flow
7. 🔄 Submit for business verification
8. 🔄 Deploy to production

---

## Support Resources

- **Meta Developer Docs**: https://developers.facebook.com/docs/whatsapp/cloud-api/
- **WhatsApp Business Platform**: https://business.whatsapp.com/
- **API Reference**: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/
- **Community Forum**: https://developers.facebook.com/community/

---

## Important Notes

⚠️ **Test Number Limitations:**
- 1000 conversations/day
- 50 unique recipients
- Expires after 90 days of inactivity

⚠️ **Production Number Requirements:**
- Business verification required
- Approved message templates
- Quality rating maintained
- Comply with WhatsApp commerce policy

⚠️ **Message Templates:**
- Required for first message or after 24 hours
- Must be pre-approved by WhatsApp
- Can take 24-48 hours for approval
- Use template for order confirmations

---

**Ready to proceed?** Once you have your credentials, I'll implement the complete WhatsApp Cloud API integration!
