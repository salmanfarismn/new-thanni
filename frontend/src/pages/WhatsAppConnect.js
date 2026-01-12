import { useState, useEffect } from 'react';
import { api } from '../App';
import { MessageSquare, Smartphone, CheckCircle, QrCode, AlertCircle, AlertTriangle, LogOut, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppConnect() {
  const [status, setStatus] = useState({ connected: false });
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

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
              <h2 className="text-xl font-bold text-slate-900 mb-2">Disconnect WhatsApp?</h2>
              <p className="text-slate-600 text-sm">
                This will safely disconnect your WhatsApp account from the system. You will be able to log back into WhatsApp on your mobile device without any issues.
              </p>
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-sky-900 text-sm mb-2">What happens after disconnect:</h3>
            <ul className="text-xs text-sky-800 space-y-1">
              <li>✓ All WhatsApp messaging will stop</li>
              <li>✓ Session credentials will be deleted</li>
              <li>✓ You can safely log back into WhatsApp mobile</li>
              <li>✓ You can reconnect later with the same or different number</li>
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
            <h3 className="font-bold text-amber-900 mb-2">⚠️ Important Safety Warning</h3>
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">DO NOT use your personal WhatsApp number for this integration!</p>
              <p>• Use a dedicated test number or business line</p>
              <p>• Personal numbers may get flagged or banned by WhatsApp</p>
              <p>• You can disconnect safely at any time using the disconnect button below</p>
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
                <h2 className="text-xl font-semibold text-emerald-900 mb-2">WhatsApp Connected!</h2>
                <p className="text-emerald-700">Your WhatsApp is connected and ready to receive orders.</p>
                {status.user && (
                  <div className="mt-3 text-sm text-emerald-600">
                    Connected as: {status.user.name || status.user.id}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Disconnect Button */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Connection Management</h2>
            <p className="text-sm text-slate-600 mb-4">
              Need to disconnect? Click the button below to safely logout and clear your session.
            </p>
            <button
              onClick={() => setShowDisconnectModal(true)}
              data-testid="disconnect-whatsapp-btn"
              className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              Disconnect WhatsApp
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
              <div>
                <h3 className="font-semibold text-sky-900 mb-1">Test Your Setup</h3>
                <p className="text-sm text-sky-800 mb-2">Send a WhatsApp message to your connected number to test the bot!</p>
                <div className="text-sm text-sky-700 bg-white rounded-lg p-3 font-mono">
                  Message: "Hi"
                </div>
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
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Scan QR Code</h2>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
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
