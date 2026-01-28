import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { CheckCircle, QrCode, AlertCircle, LogOut, RefreshCw, Smartphone, Menu, Scan, Activity, HelpCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';
import Button from '../components/ui/button';

export default function WhatsAppConnect() {
  const [status, setStatus] = useState({ connected: false });
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      checkStatus();
      if (!status.connected) {
        fetchQR();
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!window.confirm('Are you sure you want to disconnect? The bot will stop replying to customers.')) return;

    try {
      setDisconnecting(true);
      const response = await api.post('/whatsapp/disconnect');
      if (response.data.success) {
        toast.success('WhatsApp disconnected');
        setStatus({ connected: false });
        setQrCode(null);
      }
    } catch (error) {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setQrCode(null);
    await checkStatus();
    if (!status.connected) {
      await fetchQR();
    }
    toast.success('QR Code refreshed');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mb-4"></div>
        <p className="text-slate-500 font-medium">Checking connection status...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            WhatsApp Integration
            {status.connected && (
              <Badge variant="success" className="text-sm px-3 py-1">Active</Badge>
            )}
          </h1>
          <p className="text-slate-500 font-medium mt-1">Manage your automated delivery bot connection</p>
        </div>
        {status.connected && (
          <Button variant="danger" onClick={handleDisconnect} disabled={disconnecting} className="bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm">
            <LogOut size={18} className="mr-2" />
            {disconnecting ? 'Disconnecting...' : 'Disconnect Session'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Status & Connection */}
        <div className="lg:col-span-2 space-y-6">
          {status.connected ? (
            // Connected State
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm border border-white/30">
                  <CheckCircle size={48} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">System Online & Ready!</h2>
                  <p className="text-emerald-50 text-lg opacity-90 max-w-md">
                    Your WhatsApp bot is active using {status?.user?.id ? `number ending in ${status.user.id.slice(-4)}` : 'your connected number'}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 relative z-10">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-emerald-100 mb-1 text-xs font-semibold uppercase tracking-wider">
                    <Activity size={14} /> Status
                  </div>
                  <div className="text-xl font-bold">Listening</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-emerald-100 mb-1 text-xs font-semibold uppercase tracking-wider">
                    <ShieldCheck size={14} /> session
                  </div>
                  <div className="text-xl font-bold">Secure</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-emerald-100 mb-1 text-xs font-semibold uppercase tracking-wider">
                    <Smartphone size={14} /> Device
                  </div>
                  <div className="text-xl font-bold">Linked</div>
                </div>
              </div>
            </div>
          ) : (
            // Disconnected State - QR Scanner
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">
              <div className="p-1.5 bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500"></div>
              <div className="p-8 text-center">
                <div className="mb-6">
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Link your WhatsApp</h2>
                  <p className="text-slate-500 text-lg">Scan the QR code to connect the bot</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 inline-block border-2 border-dashed border-slate-300 relative group">
                  {qrCode ? (
                    <>
                      <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                          alt="WhatsApp QR Code"
                          className="w-64 h-64 mix-blend-multiply"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm rounded-2xl">
                        <Button size="sm" onClick={handleRefresh} variant="secondary">
                          <RefreshCw size={16} className="mr-2" /> Refresh Code
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="w-64 h-64 flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-400 mb-4"></div>
                      <p className="text-slate-400 text-sm font-medium">Generating secure code...</p>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-center">
                  <div className="flex items-center gap-8 text-left max-w-lg mx-auto">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-12 h-12 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 border border-sky-100 shadow-sm">
                        <Smartphone size={24} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Open App</span>
                    </div>
                    <div className="h-px w-12 bg-slate-200"></div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center text-violet-600 border border-violet-100 shadow-sm">
                        <Menu size={24} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Menu &gt; Linked Devices</span>
                    </div>
                    <div className="h-px w-12 bg-slate-200"></div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-12 h-12 bg-fuchsia-50 rounded-full flex items-center justify-center text-fuchsia-600 border border-fuchsia-100 shadow-sm">
                        <Scan size={24} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Scan QR</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <ShieldCheck size={14} /> End-to-end encrypted connection managed by <span className="font-semibold text-slate-600">Thanni Canuuu</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Information & Help */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                <HelpCircle size={20} className="text-sky-500" />
                How It Works
              </h3>

              <div className="space-y-6 relative">
                <div className="absolute left-3.5 top-2 bottom-4 w-0.5 bg-slate-100"></div>

                <div className="relative flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white border-2 border-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs shadow-sm z-10">1</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Customer Messages</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      When a customer sends "Hi" or "Order", the bot automatically responds with options.
                    </p>
                  </div>
                </div>

                <div className="relative flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white border-2 border-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs shadow-sm z-10">2</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Order Placement</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Customers select can size & quantity directly in chat. Address is collected for new users.
                    </p>
                  </div>
                </div>

                <div className="relative flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white border-2 border-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs shadow-sm z-10">3</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Instant Notification</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Orders appear on your dashboard instantly and delivery staff get WhatsApp alerts.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-sky-50 p-4 border-t border-sky-100">
              <div className="flex gap-3">
                <div className="mt-0.5">
                  <AlertCircle size={16} className="text-sky-600" />
                </div>
                <div className="text-xs text-sky-800 leading-relaxed">
                  <strong>Pro Tip:</strong> Use a dedicated business number for this bot. You can still use WhatsApp on your phone normally while linked.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
