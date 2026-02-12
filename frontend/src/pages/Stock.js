import { useState, useEffect } from 'react';
import { api, API_BASE_URL } from '../context/AppContext';
import { Plus, Minus, Archive, RefreshCw, AlertCircle, AlertTriangle, X, Trash2, Check, Camera, Hash, CheckCircle2, Droplets, Zap, AlertOctagon, Undo2, Truck, FileText, User, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Card from '../components/ui/card';
import Button from '../components/ui/button';
import Badge from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';

// Damage reasons
const DAMAGE_REASONS = [
  { id: 'broken', label: 'Broken / Crushed', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'leaked', label: 'Leakage', icon: Droplets, color: 'text-sky-500', bg: 'bg-sky-50' },
  { id: 'contaminated', label: 'Contaminated', icon: AlertOctagon, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'customer_return', label: 'Customer Return', icon: Undo2, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'delivery_damage', label: 'Delivery Damage', icon: Truck, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'other', label: 'Other Issue', icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50' }
];

export default function Stock() {
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('add'); // 'add', 'reduce', 'damage'
  const [quantity, setQuantity] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [dateFilter, setDateFilter] = useState('7'); // 'today', '7', '30'

  // Damage dialog state
  const [isDamageDialogOpen, setIsDamageDialogOpen] = useState(false);
  const [damageData, setDamageData] = useState({
    quantity: 1,
    quantity_returned: 0,
    reason: '',
    notes: '',
    order_id: '',
    litre_size: 20
  });
  const [todayDamage, setTodayDamage] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [agentReports, setAgentReports] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    loadStock();
    loadTodayDamage();
    loadSalesData();
    loadAgentReports();
  }, [dateFilter]); // Reload when filter changes

  const loadStock = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stock');
      setStock(response.data);
    } catch (error) {
      console.error('Error loading stock:', error);
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  const loadTodayDamage = async () => {
    try {
      const response = await api.get('/stock/damage/today');
      setTodayDamage(response.data);
    } catch (error) {
      console.error('Error loading damage data:', error);
    }
  };

  const loadSalesData = async () => {
    try {
      const periodMap = { 'today': 'today', '7': 'week', '30': 'month' };
      const response = await api.get(`/dashboard/sales?period=${periodMap[dateFilter] || 'today'}`);
      setSalesData(response.data);
    } catch (error) {
      console.error("Error loading sales data:", error);
    }
  };

  const loadAgentReports = async () => {
    try {
      const days = dateFilter === 'today' ? 1 : parseInt(dateFilter);
      const response = await api.get(`/damage-reports?days=${days}`);
      setAgentReports(response.data.reports || []);
    } catch (error) {
      console.error('Error loading agent reports:', error);
    }
  };

  const handleUpdate = async () => {
    if (quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (mode === 'add' && quantity > 1000) {
      toast.error('Quantity cannot exceed 1000 cans');
      return;
    }

    if (mode === 'reduce' && quantity > (stock?.available_stock || 0)) {
      toast.error(`Cannot reduce by ${quantity}. Only ${stock?.available_stock} available.`);
      return;
    }

    try {
      setUpdating(true);
      const increment = mode === 'add' ? quantity : -quantity;
      await api.put('/stock', { increment });
      toast.success(`${quantity} cans ${mode === 'add' ? 'added to' : 'removed from'} stock!`);
      setQuantity(0);
      loadStock();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error(error.response?.data?.detail || 'Failed to update stock');
    } finally {
      setUpdating(false);
    }
  };

  const handleReportDamage = async () => {
    if (!damageData.reason) {
      toast.error('Please select a damage reason');
      return;
    }
    if (damageData.quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (damageData.quantity > (stock?.available_stock || 0)) {
      toast.error(`Cannot report ${damageData.quantity} damaged. Only ${stock?.available_stock} available.`);
      return;
    }

    try {
      setUpdating(true);
      await api.post('/stock/damage', damageData);
      toast.success(`${damageData.quantity} damaged cans recorded!`);
      setIsDamageDialogOpen(false);
      setDamageData({ quantity: 1, quantity_returned: 0, reason: '', notes: '', order_id: '', litre_size: 20 });
      loadStock();
      loadTodayDamage();
    } catch (error) {
      console.error('Error recording damage:', error);
      toast.error(error.response?.data?.detail || 'Failed to record damage');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const usedStock = (stock?.total_stock || 0) - (stock?.available_stock || 0);
  const availablePercentage = stock?.total_stock > 0
    ? ((stock.available_stock / stock.total_stock) * 100).toFixed(0)
    : "0";

  const isAdd = mode === 'add';

  return (
    <div className="space-y-6 pb-20 sm:pb-0 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock Manager</h1>
          <p className="text-slate-500 font-medium text-sm">Real-time inventory control</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Today' },
              { id: '7', label: '7 Days' },
              { id: '30', label: '30 Days' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateFilter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Report Damage Button - Desktop */}
          <Button
            onClick={() => setIsDamageDialogOpen(true)}
            className="hidden sm:flex h-10 px-4 rounded-xl bg-red-50 text-red-600 border-red-100 hover:bg-red-100 font-bold text-sm gap-2"
          >
            <AlertTriangle size={16} /> Report Issue
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadStock(); loadTodayDamage(); loadAgentReports(); }}
            className="h-10 w-10 rounded-full p-0 flex items-center justify-center border-slate-200 bg-white shadow-sm active:scale-90 transition-all"
          >
            <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-slate-600`} />
          </Button>
        </div>
      </div>

      {/* Floating Action Button for Mobile - Report Issue */}
      <button
        onClick={() => setIsDamageDialogOpen(true)}
        className="fixed bottom-24 right-6 z-40 sm:hidden w-14 h-14 bg-red-500 text-white rounded-full shadow-xl shadow-red-500/30 flex items-center justify-center active:scale-90 transition-transform animate-bounce-subtle"
      >
        <AlertTriangle size={24} />
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual & Stats (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Hero Tank Card */}
          <div className="relative overflow-hidden bg-slate-900 rounded-[32px] p-6 sm:p-8 text-white shadow-xl min-h-[280px] sm:min-h-[300px] flex flex-col justify-between group">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

            <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                    <Archive size={20} className="text-sky-300" />
                  </div>
                  <span className="text-sky-200/80 font-bold text-xs uppercase tracking-widest">Main Warehouse</span>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-5xl sm:text-6xl font-black tracking-tighter text-white">{stock?.available_stock || 0}</span>
                  <span className="text-lg sm:text-xl font-bold text-white/40">/ {stock?.total_stock}</span>
                </div>
                <div className="text-sky-300 font-medium text-sm mt-1">Available Cans</div>
              </div>

              {/* Circular Gauge */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray="283"
                    strokeDashoffset={283 - (283 * Number(availablePercentage) / 100)}
                    className="text-sky-500 transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-black text-lg sm:text-xl">
                  {availablePercentage}%
                </div>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 sm:mt-8">
              <div className="bg-white/5 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-white/5">
                <div className="text-sky-200/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Used</div>
                <div className="text-xl sm:text-2xl font-black text-white">{usedStock}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-white/5">
                <div className="text-emerald-200/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Orders</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">{stock?.orders_count || 0}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-white/5">
                <div className="text-amber-200/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Collected</div>
                <div className="text-xl sm:text-2xl font-black text-amber-400">{salesData?.empty_cans_collected || 0}</div>
              </div>
              <div className="bg-red-500/10 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-red-500/20">
                <div className="text-red-200/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Damaged</div>
                <div className="text-xl sm:text-2xl font-black text-red-400">{todayDamage?.total_damaged || 0}</div>
              </div>
            </div>
          </div>

          {/* Damage History Summary (if any) */}
          {todayDamage && todayDamage.total_damaged > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-red-900">Today's Damage Report</h4>
                    <p className="text-red-600/70 text-sm">{todayDamage.total_damaged} cans reported damaged</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {todayDamage.records?.map((record, index) => {
                  const reasonObj = DAMAGE_REASONS.find(r => r.id === record.reason);
                  const Icon = reasonObj?.icon || AlertCircle;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border border-red-100">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${reasonObj?.bg || 'bg-slate-50'} ${reasonObj?.color || 'text-slate-500'}`}>
                          <Icon size={16} />
                        </div>
                        <span className="font-medium text-red-900 text-sm">{reasonObj?.label || record.reason}</span>
                      </div>
                      <Badge variant="error" className="font-bold">{record.quantity} cans</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Tips (Desktop only) */}
          <div className="hidden sm:flex bg-indigo-50/50 border border-indigo-100 rounded-3xl p-6 items-start gap-4">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl mt-1">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900 mb-1">Stock Management Tip</h4>
              <p className="text-indigo-700/80 text-sm leading-relaxed">
                Always verify physical counts before adding larger batches. Stock is automatically deducted when new orders are placed via WhatsApp. Use "Report Damage" for broken or leaked cans.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Panel (lg:col-span-5) */}
        <div className="lg:col-span-5">
          <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/60 rounded-[32px]">
            {/* Toggle Switch */}
            <div className="flex bg-slate-50 p-1.5 rounded-t-[32px] border-b border-slate-100">
              <button
                onClick={() => { setMode('add'); setQuantity(0); }}
                className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${isAdd ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <Plus size={16} strokeWidth={3} /> Replenish
              </button>
              <button
                onClick={() => { setMode('reduce'); setQuantity(0); }}
                className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${!isAdd ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <Minus size={16} strokeWidth={3} /> Deduct
              </button>
            </div>

            <div className="p-6 sm:p-8 bg-white">

              {/* Main Input */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 mb-8">
                <button
                  onClick={() => setQuantity(Math.max(0, quantity - 1))}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors active:scale-95"
                >
                  <Minus size={20} />
                </button>

                <div className="w-28 sm:w-32 text-center">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-full text-center text-4xl sm:text-5xl font-black bg-transparent border-none focus:ring-0 p-0 ${isAdd ? 'text-slate-900' : 'text-slate-900'
                      }`}
                  />
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Units</div>
                </div>

                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors active:scale-95"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-4 gap-2 mb-8">
                {[5, 10, 25, 50].map((val) => (
                  <button
                    key={val}
                    onClick={() => setQuantity(quantity + val)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${isAdd
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                      : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                      }`}
                  >
                    +{val}
                  </button>
                ))}
              </div>

              {/* Action Button */}
              <Button
                onClick={handleUpdate}
                isLoading={updating}
                disabled={updating || quantity <= 0}
                className={`w-full py-5 sm:py-6 h-auto rounded-2xl text-base sm:text-lg font-black shadow-lg shadow-current/20 transition-all hover:scale-[1.02] active:scale-[0.98] ${isAdd
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
                  : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'
                  }`}
              >
                {isAdd ? 'Confirm Receipt' : 'Confirm Deduction'}
              </Button>

            </div>
          </Card>
        </div>
      </div>

      {/* Agent Reports Feed */}
      {agentReports.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                <Camera size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Agent Reports</h4>
                <p className="text-slate-400 text-xs font-medium">Last {dateFilter === 'today' ? '24 hours' : `${dateFilter} days`} · {agentReports.length} reports</p>
              </div>
            </div>
            <button onClick={loadAgentReports} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <RefreshCw size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {agentReports.slice(0, 10).map((report) => {
              const reasonObj = DAMAGE_REASONS.find(r => r.id === report.reason);
              const Icon = reasonObj?.icon || AlertCircle;
              const timeAgo = (() => {
                if (!report.created_at) return '';
                const d = new Date(report.created_at);
                const now = new Date();
                const diffMs = now - d;
                const hours = Math.floor(diffMs / 3600000);
                if (hours < 1) return 'Just now';
                if (hours < 24) return `${hours}h ago`;
                const days = Math.floor(hours / 24);
                return `${days}d ago`;
              })();
              return (
                <div key={report.report_id} className="p-4 flex items-start gap-3 hover:bg-slate-25 transition-colors">
                  {/* Photo Thumbnail */}
                  {report.photo_url ? (
                    <button
                      onClick={() => setSelectedPhoto(`${API_BASE_URL}${report.photo_url}`)}
                      className="w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-100 flex-shrink-0 hover:border-violet-300 transition-colors relative group"
                    >
                      <img
                        src={`${API_BASE_URL}${report.photo_url}`}
                        alt="Damage"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center flex-shrink-0">
                      <Camera size={18} className="text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-md ${reasonObj?.bg || 'bg-slate-50'} ${reasonObj?.color || 'text-slate-500'}`}>
                        <Icon size={12} />
                      </div>
                      <span className="font-bold text-slate-900 text-sm truncate">{reasonObj?.label || report.reason}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <User size={10} className="text-slate-400" />
                      <span className="text-xs text-slate-500 font-medium">{report.agent_name}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-red-500 text-xs font-bold">{report.damaged_qty} dmg</span>
                      {report.returned_qty > 0 && (
                        <>
                          <span className="text-slate-200">·</span>
                          <span className="text-blue-500 text-xs font-bold">{report.returned_qty} ret</span>
                        </>
                      )}
                    </div>
                    {report.notes && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">{report.notes}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-300 font-medium flex items-center gap-1 flex-shrink-0">
                    <Clock size={10} />{timeAgo}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={selectedPhoto}
            alt="Damage report"
            className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Report Damage Dialog */}
      <Dialog open={isDamageDialogOpen} onOpenChange={setIsDamageDialogOpen}>
        <DialogContent className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-0 shadow-lg duration-200 sm:rounded-lg md:w-full">
          <DialogHeader className="p-6 pb-2 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <AlertTriangle size={20} fill="currentColor" className="opacity-20" />
                <AlertTriangle size={20} className="absolute" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Report Issue</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium text-xs">Record damaged stock. Inventory will be deducted.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 max-h-[70vh]">

            {/* 1. Can Config Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Can Configuration</label>
              </div>

              <div className="p-1 bg-slate-100/80 rounded-2xl flex relative">
                {[20, 25].map((size) => (
                  <button
                    key={size}
                    onClick={() => setDamageData(prev => ({ ...prev, litre_size: size }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all relative z-10 ${damageData.litre_size === size
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
                      : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    <Droplets size={14} className={damageData.litre_size === size ? 'text-sky-500' : 'text-slate-300'} />
                    {size} Litre
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Quantity Inputs Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Damaged */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-red-400 uppercase tracking-wider ml-1">Damaged Qty</label>
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-1 flex items-center justify-between relative overflow-hidden group hover:border-red-200 transition-colors">
                  <button
                    onClick={() => setDamageData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-white text-red-400 shadow-sm border border-red-50 active:scale-95 transition-transform"
                  >
                    <Minus size={20} strokeWidth={3} />
                  </button>
                  <input
                    type="number"
                    value={damageData.quantity}
                    onChange={(e) => setDamageData(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full text-center bg-transparent border-none text-2xl font-black text-red-600 focus:ring-0 p-0"
                  />
                  <button
                    onClick={() => setDamageData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-500 text-white shadow-md shadow-red-500/20 active:scale-95 transition-transform"
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>
              </div>

              {/* Returned */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Returned Empty</label>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-1 flex items-center justify-between relative overflow-hidden group hover:border-slate-200 transition-colors">
                  <button
                    onClick={() => setDamageData(prev => ({ ...prev, quantity_returned: Math.max(0, prev.quantity_returned - 1) }))}
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm border border-slate-100 active:scale-95 transition-transform"
                  >
                    <Minus size={20} strokeWidth={3} />
                  </button>
                  <input
                    type="number"
                    value={damageData.quantity_returned}
                    onChange={(e) => setDamageData(prev => ({ ...prev, quantity_returned: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-full text-center bg-transparent border-none text-2xl font-black text-slate-700 focus:ring-0 p-0"
                  />
                  <button
                    onClick={() => setDamageData(prev => ({ ...prev, quantity_returned: prev.quantity_returned + 1 }))}
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-900/20 active:scale-95 transition-transform"
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Reason Selection */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Issue Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {DAMAGE_REASONS.map(reason => (
                  <button
                    key={reason.id}
                    onClick={() => setDamageData(prev => ({ ...prev, reason: reason.id }))}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all group overflow-hidden ${damageData.reason === reason.id
                      ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10'
                      : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <div className="relative z-10 flex flex-col gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${damageData.reason === reason.id ? 'bg-white/20 text-white' : `${reason.bg} ${reason.color}`}`}>
                        {(() => {
                          const Icon = reason.icon;
                          return <Icon size={20} />;
                        })()}
                      </div>
                      <span className="font-bold text-xs">{reason.label}</span>
                    </div>
                    {damageData.reason === reason.id && (
                      <div className="absolute top-3 right-3 text-white">
                        <CheckCircle2 size={18} fill="white" className="text-emerald-500" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Details Section */}
            <div className="space-y-4 pt-2">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Order Ref (Optional)</label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={16} />
                  <input
                    type="text"
                    value={damageData.order_id}
                    onChange={(e) => setDamageData(prev => ({ ...prev, order_id: e.target.value }))}
                    placeholder="ORD-123..."
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-200 focus:ring-0 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Notes</label>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Optional</span>
                </div>
                <textarea
                  value={damageData.notes}
                  onChange={(e) => setDamageData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any specific details about the damage..."
                  rows={3}
                  className="w-full p-4 bg-slate-50 border-transparent rounded-2xl text-sm font-medium focus:bg-white focus:border-slate-200 focus:ring-0 transition-all resize-none placeholder:text-slate-400"
                />
              </div>
            </div>



          </div>

          <DialogFooter className="p-4 bg-white border-t border-slate-50">
            <div className="flex gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => setIsDamageDialogOpen(false)}
                className="flex-1 h-14 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReportDamage}
                disabled={updating || !damageData.reason}
                isLoading={updating}
                className="flex-[1.5] h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-base font-bold shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
              >
                Submit Report
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
