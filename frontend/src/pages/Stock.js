import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Droplets, Plus, Minus, Save, TrendingUp, Archive, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Card, { GlassCard } from '../components/ui/card';
import Button from '../components/ui/button';
import Badge from '../components/ui/badge';

export default function Stock() {
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStock, setNewStock] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadStock();
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

  const updateStock = async () => {
    if (newStock < 0 || newStock > 1000) {
      toast.error('Please enter a valid stock quantity (0-1000)');
      return;
    }

    try {
      setUpdating(true);
      await api.put('/stock', { increment: newStock });
      toast.success(`${newStock} cans added to stock successfully!`);
      setNewStock(0);
      loadStock();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const usedStock = (stock?.total_stock || 0) - (stock?.available_stock || 0);
  const usagePercentage = stock?.total_stock > 0
    ? ((usedStock / stock.total_stock) * 100).toFixed(1)
    : "0.0";

  const availablePercentage = stock?.total_stock > 0
    ? ((stock.available_stock / stock.total_stock) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6 animate-fade-in" data-testid="stock-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock Manager</h1>
          <p className="text-slate-500 font-medium mt-1">Real-time inventory control</p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadStock} disabled={loading} className="text-sky-600 gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual Overview Card */}
        <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-2xl flex flex-col justify-between" data-testid="stock-overview-card">
          {/* Background Effects */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-8">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                <Droplets size={32} className="text-sky-400" />
              </div>

              <div className="flex flex-col items-end">
                <span className="text-sky-400 font-bold tracking-wider text-xs uppercase mb-1">Status</span>
                <Badge className={stock?.available_stock > 0 ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}>
                  {stock?.available_stock > 0 ? 'IN STOCK' : 'OUT OF STOCK'}
                </Badge>
              </div>
            </div>

            <div className="mb-8 text-center">
              <div className="text-6xl font-black tracking-tight mb-2 text-white">
                {stock?.available_stock || 0}
              </div>
              <div className="text-sky-200 font-medium text-lg">Cans Available Now</div>
            </div>

            {/* Circular Progress or Bar */}
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-slate-400 font-medium px-1">
                <span>0</span>
                <span>Capacity: {stock?.total_stock || 0}</span>
              </div>
              <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 shadow-[0_0_20px_rgba(14,165,233,0.5)] transition-all duration-1000 ease-out relative"
                  style={{ width: `${availablePercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="wx-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Replenish Stock</h3>
                <p className="text-slate-500 text-sm">Add new inventory for today</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center gap-6 mb-6">
              <div className="flex items-center gap-6 w-full max-w-sm justify-center">
                <button
                  onClick={() => setNewStock(Math.max(0, newStock - 10))}
                  className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all"
                >
                  <Minus size={20} />
                </button>

                <div className="flex-1 text-center">
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                    className="w-full text-center text-4xl font-black text-slate-900 bg-transparent border-none focus:ring-0 p-0"
                  />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">CANS</span>
                </div>

                <button
                  onClick={() => setNewStock(newStock + 10)}
                  className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <Button
              onClick={updateStock}
              disabled={updating || newStock <= 0}
              className="w-full h-14 text-lg bg-sky-500 hover:bg-sky-600 shadow-sky-500/25"
              isLoading={updating}
            >
              <Save size={20} className="mr-2" />
              {updating ? 'Updating Inventory...' : 'Confirm Addition'}
            </Button>
          </Card>

          {/* Tips Card */}
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 flex gap-4">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg h-fit">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-amber-800 text-sm mb-1">Important Note</h4>
              <p className="text-amber-700 text-sm leading-relaxed">
                Stock automatically reduces when orders are placed via WhatsApp.
                Only manually add stock when receiving new physical deliveries to the warehouse.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="p-5 flex items-center gap-4 bg-white border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <Archive size={20} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Capacity</div>
            <div className="text-2xl font-black text-slate-900">{stock?.total_stock || 0}</div>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 bg-white border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Used</div>
            <div className="text-2xl font-black text-slate-900">{usedStock}</div>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 bg-white border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
            <Droplets size={20} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Orders Filled</div>
            <div className="text-2xl font-black text-slate-900">{stock?.orders_count || 0}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
