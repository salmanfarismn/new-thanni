import { useState, useEffect } from 'react';
import { api } from '../App';
import { CheckCircle, QrCode, AlertCircle, LogOut, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppConnect() {
  const [status, setStatus] = useState({ connected: false });
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

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

  const handleDisconnect = async () => {
    if (!window.confirm('Stop WhatsApp automation? You can reconnect anytime.')) return;

    try {
      const response = await api.post('/whatsapp/disconnect');
      if (response.data.success) {
        toast.success('WhatsApp disconnected');
        setStatus({ connected: false });
        setQrCode(null);
      }
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const handleRefresh = async () => {
    await checkStatus();
    if (!status.connected) {
      await fetchQR();
    }
    toast.success('Status refreshed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-6">
      {/* Status Card */}
      <div className={`rounded-2xl p-6 text-center ${status.connected
          ? 'bg-emerald-50 border-2 border-emerald-200'
          : 'bg-amber-50 border-2 border-amber-200'
        }`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${status.connected ? 'bg-emerald-500' : 'bg-amber-500'
          }`}>
          {status.connected ? (
            <CheckCircle className="text-white" size={32} />
          ) : (
            <AlertCircle className="text-white" size={32} />
          )}
        </div>
        <h1 className={`text-2xl font-bold mb-2 ${status.connected ? 'text-emerald-900' : 'text-amber-900'
          }`}>
          {status.connected ? 'WhatsApp Connected' : 'WhatsApp Not Connected'}
        </h1>
        <p className={`text-sm ${status.connected ? 'text-emerald-700' : 'text-amber-700'
          }`}>
          {status.connected
            ? 'Automation is active. Orders will be processed automatically.'
            : 'Connect WhatsApp to start receiving orders.'}
        </p>
      </div>

      {status.connected ? (
        // Connected State
        <div className="space-y-4">
          <button
            onClick={handleDisconnect}
            className="w-full bg-red-500 text-white py-4 rounded-xl font-semibold hover:bg-red-600 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            Disconnect WhatsApp
          </button>

          {/* Collapsible More Info */}
          <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowMoreInfo(!showMoreInfo)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <span className="font-semibold text-slate-900">How it works</span>
              {showMoreInfo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showMoreInfo && (
              <div className="px-6 pb-6 pt-2">
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600 text-xs">1</div>
                    <div>
                      <div className="font-medium">Customer sends "Hi" on WhatsApp</div>
                      <div className="text-xs text-slate-600">Bot asks for details if first time</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600 text-xs">2</div>
                    <div>
                      <div className="font-medium">Customer places order</div>
                      <div className="text-xs text-slate-600">Chooses quantity and confirms</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600 text-xs">3</div>
                    <div>
                      <div className="font-medium">Order auto-assigned</div>
                      <div className="text-xs text-slate-600">Delivery staff gets notification</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sky-600 text-xs">4</div>
                    <div>
                      <div className="font-medium">Track on dashboard</div>
                      <div className="text-xs text-slate-600">Mark delivered and collect payment</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-600">
                    <strong>Note:</strong> You can continue using WhatsApp normally on your phone. The system only automates customer order messages.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Disconnected State - QR Code
        <div className="space-y-4">
          {qrCode ? (
            <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 text-center">
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-lg mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Open WhatsApp → Linked Devices → Link a Device → Scan this code
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border-2 border-slate-200 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
              <p className="text-slate-600">Generating QR code...</p>
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="w-full bg-sky-500 text-white py-4 rounded-xl font-semibold hover:bg-sky-600 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            Refresh QR Code
          </button>

          {/* Collapsible More Info */}
          <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowMoreInfo(!showMoreInfo)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <span className="font-semibold text-slate-900">Setup help & safety</span>
              {showMoreInfo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showMoreInfo && (
              <div className="px-6 pb-6 pt-2 space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2 text-sm">How to connect:</h3>
                  <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap Menu (⋮) → Linked Devices</li>
                    <li>Tap "Link a Device"</li>
                    <li>Point phone at QR code above</li>
                    <li>Wait for connection</li>
                  </ol>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <h3 className="font-semibold text-amber-900 mb-2 text-sm">⚠️ Important:</h3>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Use a business/dedicated number (not personal)</li>
                    <li>• Connection works like WhatsApp Web</li>
                    <li>• You can disconnect safely anytime</li>
                    <li>• Phone stays usable after disconnect</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
