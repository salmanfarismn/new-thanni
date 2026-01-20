import { useState, useEffect } from 'react';
import { api } from '../App';
import { Droplets, Plus, Minus, Save, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

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
      // Removed setNewStock(response.data.total_stock) to avoid confusing "Set" vs "Add"
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
      setNewStock(0); // Reset after adding
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
  const usagePercentage = ((usedStock / (stock?.total_stock || 1)) * 100).toFixed(1);

  return (
    <div className="space-y-6" data-testid="stock-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Stock Management</h1>
        <p className="text-slate-600 mt-1">Manage daily water can inventory</p>
      </div>

      <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden" data-testid="stock-overview-card">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Droplets size={28} />
            </div>
            <div>
              <div className="text-sm text-sky-100">Today's Stock Status</div>
              <div className="text-3xl font-bold mt-1">{stock?.available_stock || 0} Available</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-sm text-sky-100 mb-1">Total Stock</div>
              <div className="text-2xl font-bold">{stock?.total_stock || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-sm text-sky-100 mb-1">Used</div>
              <div className="text-2xl font-bold">{usedStock}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-sm text-sky-100 mb-1">Orders</div>
              <div className="text-2xl font-bold">{stock?.orders_count || 0}</div>
            </div>
          </div>

          <div className="bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
            <div
              className="bg-white h-full transition-all duration-500 rounded-full"
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-sky-100">
            <span>{usagePercentage}% Used</span>
            <span>{(100 - parseFloat(usagePercentage)).toFixed(1)}% Available</span>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl" />
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" data-testid="update-stock-card">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Add to Daily Stock</h2>
        <p className="text-sm text-slate-600 mb-6">Enter the number of cans to add to today's inventory</p>

        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setNewStock(Math.max(0, newStock - 10))}
            data-testid="decrease-stock-btn"
            className="w-14 h-14 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors active:scale-95"
          >
            <Minus size={24} className="text-slate-700" />
          </button>

          <div className="flex-1 max-w-xs">
            <input
              type="number"
              value={newStock}
              onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
              data-testid="stock-input"
              className="w-full text-center text-4xl font-bold text-slate-900 border-2 border-slate-200 rounded-xl py-4 focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all"
            />
            <div className="text-center text-sm text-slate-500 mt-2">Total cans</div>
          </div>

          <button
            onClick={() => setNewStock(newStock + 10)}
            data-testid="increase-stock-btn"
            className="w-14 h-14 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors active:scale-95"
          >
            <Plus size={24} className="text-slate-700" />
          </button>
        </div>

        <button
          onClick={updateStock}
          disabled={updating || newStock <= 0}
          data-testid="save-stock-btn"
          className="w-full bg-sky-500 text-white py-4 rounded-xl font-semibold hover:bg-sky-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
        >
          <Save size={20} />
          {updating ? 'Updating...' : `Add ${newStock} Cans`}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5" data-testid="stock-info-card">
        <div className="flex items-start gap-3">
          <TrendingUp className="text-amber-600 flex-shrink-0 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Stock Tips</h3>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• Update stock at the start of each day</li>
              <li>• Stock automatically reduces when orders are placed</li>
              <li>• Orders stop automatically when stock reaches zero</li>
              <li>• You can increase stock during the day if needed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
