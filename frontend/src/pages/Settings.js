import { useState, useEffect } from 'react';
import { api } from '../App';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Save, Droplet, IndianRupee, Plus, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const response = await api.get('/price-settings');
      const existingPrices = response.data;
      
      if (existingPrices.length === 0) {
        setPrices([
          { litre_size: 20, price_per_can: 45, is_active: true },
          { litre_size: 25, price_per_can: 55, is_active: true }
        ]);
      } else {
        setPrices(existingPrices);
      }
    } catch (error) {
      console.error('Error loading prices:', error);
      toast.error('Failed to load price settings');
    } finally {
      setLoading(false);
    }
  };

  const updatePrice = (litreSize, newPrice) => {
    setPrices(prices.map(p => 
      p.litre_size === litreSize 
        ? { ...p, price_per_can: parseFloat(newPrice) || 0 }
        : p
    ));
  };

  const toggleActive = (litreSize) => {
    setPrices(prices.map(p => 
      p.litre_size === litreSize 
        ? { ...p, is_active: !p.is_active }
        : p
    ));
  };

  const savePrices = async () => {
    try {
      setSaving(true);
      
      for (const price of prices) {
        await api.post('/price-settings', price);
      }
      
      toast.success('Price settings saved successfully!');
      loadPrices();
    } catch (error) {
      console.error('Error saving prices:', error);
      toast.error('Failed to save price settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-600 mt-1">Manage pricing and configurations</p>
      </div>

      <Link 
        to="/shifts"
        className="block bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
        data-testid="shifts-link"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Clock className="text-white" size={28} />
            </div>
            <div>
              <div className="text-xl font-bold mb-1">Delivery Shifts</div>
              <div className="text-sky-100">Manage daily schedules for delivery staff</div>
            </div>
          </div>
          <ArrowRight className="text-white" size={24} />
        </div>
      </Link>

      <div className="bg-sky-50 border border-sky-200 rounded-xl p-5" data-testid="pricing-info">
        <div className="flex items-start gap-3">
          <SettingsIcon className="text-sky-600 flex-shrink-0 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-sky-900 mb-1">Price Configuration</h3>
            <p className="text-sm text-sky-800">Set prices for different litre sizes. Updated prices apply only to new orders. Existing orders remain unchanged.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Water Can Pricing</h2>
        
        <div className="space-y-4">
          {prices.map((price) => (
            <div 
              key={price.litre_size}
              className={`border-2 rounded-xl p-5 transition-all ${
                price.is_active 
                  ? 'border-sky-200 bg-sky-50/30' 
                  : 'border-slate-200 bg-slate-50 opacity-60'
              }`}
              data-testid={`price-card-${price.litre_size}l`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    price.is_active ? 'bg-sky-500' : 'bg-slate-400'
                  }`}>
                    <Droplet className="text-white" size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{price.litre_size} Litre</div>
                    <div className="text-sm text-slate-600">Water Can</div>
                  </div>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={price.is_active}
                    onChange={() => toggleActive(price.litre_size)}
                    data-testid={`toggle-active-${price.litre_size}l`}
                    className="w-5 h-5 text-sky-500 rounded focus:ring-2 focus:ring-sky-200"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {price.is_active ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Price per Can
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <IndianRupee size={18} className="text-slate-400" />
                    </div>
                    <input
                      type="number"
                      value={price.price_per_can}
                      onChange={(e) => updatePrice(price.litre_size, e.target.value)}
                      data-testid={`price-input-${price.litre_size}l`}
                      disabled={!price.is_active}
                      className="w-full pl-12 pr-4 py-3 text-xl font-bold text-slate-900 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {!price.is_active && (
                <div className="mt-3 text-sm text-amber-600 font-medium">
                  ⚠️ This size is currently disabled and won't appear in customer orders
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={savePrices}
            disabled={saving}
            data-testid="save-prices-btn"
            className="flex-1 bg-sky-500 text-white py-4 rounded-xl font-semibold hover:bg-sky-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={20} />
                Save Price Settings
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-semibold text-amber-900 mb-2">Important Notes</h3>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Price changes apply only to new orders</li>
          <li>• Existing orders keep their original pricing</li>
          <li>• Inactive sizes won't be available for customer orders</li>
          <li>• Prices are locked at the time of order confirmation</li>
        </ul>
      </div>
    </div>
  );
}
