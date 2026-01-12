import { useState, useEffect } from 'react';
import { api } from '../App';
import { MessageSquare, Smartphone, CheckCircle, QrCode, AlertCircle, AlertTriangle, LogOut, RefreshCw, XCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppConnect() {
  const [status, setStatus] = useState({ connected: false });
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      checkStatus();
      if (!status.connected) {
        fetchQR();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const response = await api.get('/whatsapp/status');
      setStatus(response.data);
      if (response.data.connected) {
        setQrCode(null);
      }
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQR = async () => {
    try {
      const response = await api.get('/whatsapp/qr');
      if (response.data.qr) {
        setQrCode(response.data.qr);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    await checkStatus();
    if (!status.connected) {
      await fetchQR();
    }
    setChecking(false);
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      const response = await api.post('/whatsapp/disconnect');
      
      if (response.data.success) {
        toast.success('WhatsApp disconnected successfully!');
        setStatus({ connected: false });
        setQrCode(null);
        setShowDisconnectModal(false);
      } else {
        toast.error('Failed to disconnect WhatsApp');
      }
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
      toast.error('Failed to disconnect WhatsApp');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    try {
      setReconnecting(true);
      const response = await api.post('/whatsapp/reconnect');
      
      if (response.data.success) {
        toast.success('Reconnection initiated. Please scan the QR code.');
        await checkStatus();
        await fetchQR();
      } else {
        toast.error('Failed to reconnect WhatsApp');
      }
    } catch (error) {
      console.error('Error reconnecting WhatsApp:', error);
      toast.error('Failed to reconnect WhatsApp');
    } finally {
      setReconnecting(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone || testPhone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    try {
      setSendingTest(true);
      
      // Send test webhook to simulate customer message
      const response = await api.post('/whatsapp/webhook', {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: testPhone,
                id: `test_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000),
                type: 'text',
                text: { body: 'Hi' }
              }],
              contacts: [{ profile: { name: 'Test User' } }]
            }
          }]
        }]
      });

      if (response.data.processed) {
        toast.success('Test message sent! Check if you received WhatsApp reply.');
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      toast.error('Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  const DisconnectModal = () => {
    if (!showDisconnectModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDisconnectModal(false)} data-testid="disconnect-modal">
        <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Disconnect WhatsApp Automation?</h2>
              <p className="text-slate-600 text-sm">
                This will safely stop automation but keep your WhatsApp working normally. Customers won't be able to place automated orders until you reconnect.
              </p>
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-sky-900 text-sm mb-2">What happens after disconnect:</h3>
            <ul className="text-xs text-sky-800 space-y-1">
              <li>✓ All automated customer order responses will stop</li>
              <li>✓ Delivery boy notifications will stop</li>
              <li>✓ Your WhatsApp continues working normally on your phone</li>
              <li>✓ Your personal chats remain untouched</li>
              <li>✓ Dashboard and order history stay intact</li>
              <li>✓ You can reconnect anytime</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDisconnectModal(false)}
              disabled={disconnecting}
              data-testid="cancel-disconnect-btn"
              className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              data-testid="confirm-disconnect-btn"
              className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {disconnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Disconnecting...
                </>
              ) : (
                <>
                  <LogOut size={18} />
                  Disconnect
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="whatsapp-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">WhatsApp Integration</h1>
        <p className="text-slate-600 mt-1">Connect your WhatsApp for order management</p>
      </div>

      {/* Safety Warning Banner */}
      <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-5" data-testid="safety-banner">
        <div className="flex items-start gap-3">
          <CheckCircle className="text-sky-600 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="font-bold text-sky-900 mb-2">✓ Safe for Your Personal WhatsApp</h3>
            <div className="text-sm text-sky-800 space-y-1">
              <p className="font-semibold">This connection is SAFE:</p>
              <p>• You can continue using WhatsApp normally on your phone</p>
              <p>• Your personal chats remain private and untouched</p>
              <p>• The system only automates customer order messages</p>
              <p>• You can disconnect anytime without losing WhatsApp access</p>
              <p>• Works like WhatsApp Web - your phone stays connected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5" data-testid="warning-banner">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="font-bold text-amber-900 mb-2">⚠️ Important: Use Your Business WhatsApp</h3>
            <div className="text-sm text-amber-800 space-y-1">
              <p>• This connects YOUR WhatsApp number as the business contact</p>
              <p>• Customers will message this number to place orders</p>
              <p>• You can still use WhatsApp normally on your phone</p>
              <p>• The system automates responses for customer orders only</p>
              <p>• Disconnect anytime to stop automation</p>
            </div>
          </div>
        </div>
      </div>

      {status.connected ? (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6" data-testid="connected-status">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-emerald-900 mb-2">WhatsApp Automation Active!</h2>
                <p className="text-emerald-700">Your WhatsApp is connected. Customer orders are being automated. You can continue using WhatsApp normally on your phone.</p>
                {status.user && (
                  <div className="mt-3 text-sm text-emerald-600 font-semibold">
                    Connected Number: {status.user.name || status.user.id}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connection Status and Management */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Automation Management</h2>
            <p className="text-sm text-slate-600 mb-4">
              Need to stop automation temporarily? Disconnect to pause all automated responses. Your WhatsApp will continue working normally on your phone.
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-amber-900 text-sm mb-2">While Connected:</h3>
              <ul className="text-xs text-amber-800 space-y-1">
                <li>✓ Customers get instant automated replies</li>
                <li>✓ Orders created automatically in dashboard</li>
                <li>✓ Delivery boys receive order notifications</li>
                <li>✓ Status updates sync in real-time</li>
                <li>✓ You can still use WhatsApp normally on phone</li>
              </ul>
            </div>
            
            <button
              onClick={() => setShowDisconnectModal(true)}
              data-testid="disconnect-whatsapp-btn"
              className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              Stop Automation (Disconnect)
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare size={20} className="text-sky-500" />
              How Customers Order
            </h2>
            <div className="space-y-3 text-slate-700">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600">1</div>
                <div>
                  <div className="font-medium">Customer sends "Hi" or "Water" on WhatsApp</div>
                  <div className="text-sm text-slate-600">Bot asks for name and address (if first time)</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600">2</div>
                <div>
                  <div className="font-medium">Bot shows available stock</div>
                  <div className="text-sm text-slate-600">Customer replies with quantity (1, 2, 3, etc.)</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600">3</div>
                <div>
                  <div className="font-medium">Order confirmed automatically</div>
                  <div className="text-sm text-slate-600">Delivery staff gets assignment via WhatsApp</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600">4</div>
                <div>
                  <div className="font-medium">Track everything on dashboard</div>
                  <div className="text-sm text-slate-600">Mark delivered and collect payment</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Smartphone className="text-sky-600 flex-shrink-0 mt-1" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-sky-900 mb-1">Test Your Setup</h3>
                <p className="text-sm text-sky-800 mb-3">Send a test message to verify automation is working</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Enter phone number (e.g., 919876543210)"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    data-testid="test-phone-input"
                    className="flex-1 px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-400 text-sm"
                  />
                  <button
                    onClick={handleSendTestMessage}
                    disabled={sendingTest || !testPhone}
                    data-testid="send-test-btn"
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sendingTest ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Test
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-sky-700 mt-2">
                  Enter your WhatsApp number to receive a test welcome message
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6" data-testid="disconnected-status">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-amber-900 mb-2">WhatsApp Not Connected</h2>
                <p className="text-amber-700">Scan the QR code below to connect your WhatsApp.</p>
              </div>
            </div>
          </div>

          {qrCode ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center" data-testid="qr-code-container">
              <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="text-sky-600" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Connect Your WhatsApp</h2>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Scan this QR code with your WhatsApp to enable automation. Works like WhatsApp Web - you stay connected on your phone.
              </p>
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-lg">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                  data-testid="qr-code-image"
                />
              </div>
              <p className="text-sm text-slate-500 mt-4">QR code refreshes automatically every 60 seconds</p>
              
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mt-6 text-left">
                <h3 className="font-semibold text-sky-900 text-sm mb-2">How to Scan:</h3>
                <ol className="text-sm text-sky-800 space-y-1">
                  <li>1. Open WhatsApp on your phone</li>
                  <li>2. Tap Menu (⋮) → Linked Devices</li>
                  <li>3. Tap "Link a Device"</li>
                  <li>4. Point your phone at this screen to scan</li>
                  <li>5. Your automation will activate instantly!</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center" data-testid="qr-loading">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
              <p className="text-slate-600">Generating QR code...</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={checking}
              data-testid="refresh-status-btn"
              className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-xl font-semibold hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking...' : 'Refresh Status'}
            </button>
            
            <button
              onClick={handleReconnect}
              disabled={reconnecting}
              data-testid="reconnect-btn"
              className="flex-1 bg-sky-500 text-white py-4 rounded-xl font-semibold hover:bg-sky-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              {reconnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Reconnect
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Setup Instructions</h3>
            <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
              <li>Make sure the WhatsApp service is running on your server</li>
              <li>Use a dedicated test number (NOT your personal WhatsApp)</li>
              <li>Open WhatsApp on your phone</li>
              <li>Go to Settings → Linked Devices</li>
              <li>Tap "Link a Device"</li>
              <li>Scan the QR code shown above</li>
              <li>Wait for connection confirmation</li>
            </ol>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
              <XCircle size={18} />
              Safety Reminders
            </h3>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• Never use your personal WhatsApp number</li>
              <li>• Use a separate test or business number</li>
              <li>• You can disconnect at any time</li>
              <li>• Disconnecting is safe and reversible</li>
            </ul>
          </div>
        </div>
      )}

      <DisconnectModal />
    </div>
  );
}
