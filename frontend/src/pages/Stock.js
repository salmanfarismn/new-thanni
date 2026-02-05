import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Plus, Minus, Archive, RefreshCw, AlertCircle, AlertTriangle, X, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import Card from '../components/ui/card';
import Button from '../components/ui/button';
import Badge from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';

// Damage reasons
const DAMAGE_REASONS = [
  { id: 'broken', label: 'Broken', icon: '💥' },
  { id: 'leaked', label: 'Leaked', icon: '💧' },
  { id: 'contaminated', label: 'Contaminated', icon: '☣️' },
  { id: 'customer_return', label: 'Customer Return', icon: '↩️' },
  { id: 'delivery_damage', label: 'Delivery Damage', icon: '🚚' },
  { id: 'other', label: 'Other', icon: '📝' }
];

export default function Stock() {
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('add'); // 'add', 'reduce', 'damage'
  const [quantity, setQuantity] = useState(0);
  const [updating, setUpdating] = useState(false);

  // Damage dialog state
  const [isDamageDialogOpen, setIsDamageDialogOpen] = useState(false);
  const [damageData, setDamageData] = useState({
    quantity: 1,
    reason: '',
    notes: '',
    litre_size: 20
  });
  const [todayDamage, setTodayDamage] = useState(null);

  useEffect(() => {
    loadStock();
    loadTodayDamage();
  }, []);

  const loadStock = async () => {
    try {
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
      setDamageData({ quantity: 1, reason: '', notes: '', litre_size: 20 });
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
          {/* Report Damage Button */}
          <Button
            onClick={() => setIsDamageDialogOpen(true)}
            className="h-10 px-4 rounded-xl bg-red-50 text-red-600 border-red-100 hover:bg-red-100 font-bold text-sm gap-2"
          >
            <AlertTriangle size={16} /> Report Damage
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadStock(); loadTodayDamage(); }}
            className="h-10 w-10 rounded-full p-0 flex items-center justify-center border-slate-200 bg-white shadow-sm active:scale-90 transition-all"
          >
            <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-slate-600`} />
          </Button>
        </div>
      </div>

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
            <div className="relative z-10 grid grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8">
              <div className="bg-white/5 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-white/5">
                <div className="text-sky-200/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Used</div>
                <div className="text-xl sm:text-2xl font-black text-white">{usedStock}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-white/5">
                <div className="text-emerald-200/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Orders</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">{stock?.orders_count || 0}</div>
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
                {todayDamage.records?.map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border border-red-100">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{DAMAGE_REASONS.find(r => r.id === record.reason)?.icon || '📝'}</span>
                      <span className="font-medium text-red-900 text-sm">{DAMAGE_REASONS.find(r => r.id === record.reason)?.label || record.reason}</span>
                    </div>
                    <Badge variant="error" className="font-bold">{record.quantity} cans</Badge>
                  </div>
                ))}
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

      {/* Report Damage Dialog */}
      <Dialog open={isDamageDialogOpen} onOpenChange={setIsDamageDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] bg-white rounded-[32px] p-0 overflow-hidden border-0 shadow-2xl flex flex-col">
          <DialogHeader className="p-6 pb-4 flex-shrink-0 bg-white border-b border-slate-50">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-xl text-red-600">
                <AlertTriangle size={18} />
              </div>
              Report Damaged Cans
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-1">
              Record damaged, broken, or leaked cans to deduct from inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quantity Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</label>
              <div className="flex items-center justify-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <button
                  onClick={() => setDamageData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center active:scale-95"
                >
                  <Minus size={18} />
                </button>
                <div className="text-center">
                  <input
                    type="number"
                    value={damageData.quantity}
                    onChange={(e) => setDamageData(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-20 text-center text-3xl font-black bg-transparent border-none focus:ring-0 p-0"
                  />
                  <div className="text-[10px] font-bold text-slate-400 uppercase">cans</div>
                </div>
                <button
                  onClick={() => setDamageData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center active:scale-95"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Can Size */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Can Size</label>
              <div className="grid grid-cols-2 gap-3">
                {[20, 25].map(size => (
                  <button
                    key={size}
                    onClick={() => setDamageData(prev => ({ ...prev, litre_size: size }))}
                    className={`py-3 rounded-xl border-2 font-bold transition-all ${damageData.litre_size === size
                      ? 'bg-red-50 border-red-500 text-red-600'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                  >
                    {size}L
                  </button>
                ))}
              </div>
            </div>

            {/* Damage Reason */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason *</label>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_REASONS.map(reason => (
                  <button
                    key={reason.id}
                    onClick={() => setDamageData(prev => ({ ...prev, reason: reason.id }))}
                    className={`py-3 px-4 rounded-xl border-2 text-left transition-all flex items-center gap-2 ${damageData.reason === reason.id
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                  >
                    <span className="text-lg">{reason.icon}</span>
                    <span className="font-bold text-sm">{reason.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes (Optional)</label>
              <textarea
                value={damageData.notes}
                onChange={(e) => setDamageData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details..."
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-slate-50 bg-white flex-shrink-0">
            <div className="flex gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => setIsDamageDialogOpen(false)}
                className="flex-1 h-12 rounded-xl font-bold text-slate-500"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReportDamage}
                disabled={updating || !damageData.reason}
                isLoading={updating}
                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg shadow-red-500/30"
              >
                <Check size={18} className="mr-2" />
                Confirm
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
