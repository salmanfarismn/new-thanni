import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../context/AppContext';
import { getVendor } from '../api/axios';
import { Package, TruckIcon, IndianRupee, Droplets, CheckCircle, Clock, AlertCircle, Calendar, Filter, TrendingUp, Users, ArrowUpRight, Zap, Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import Card, { GlassCard } from '../components/ui/card';
import Button from '../components/ui/button';
import Badge from '../components/ui/badge';

export default function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);

  // Filter state
  const [salesData, setSalesData] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesFilter, setSalesFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Notification state
  const [previousOrderIds, setPreviousOrderIds] = useState(new Set());
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const [showNotification, setShowNotification] = useState(false);

  // Greeting state - personalized for vendor
  const [greeting, setGreeting] = useState({
    greeting: 'Good ' + (new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'),
    vendor_name: getVendor()?.name || getVendor()?.business_name || 'Admin'
  });

  useEffect(() => {
    loadData();
    loadGreeting();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSalesData();
  }, [salesFilter, customStartDate, customEndDate]);

  const loadGreeting = async () => {
    try {
      const res = await api.get('/auth/greeting');
      setGreeting({
        greeting: res.data.greeting,
        vendor_name: res.data.vendor_name
      });
    } catch (error) {
      // Fallback to localStorage greeting already set in initial state
      console.log('Using fallback greeting');
    }
  };

  const loadData = async () => {
    try {
      const [metricsRes, ordersRes, staffRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/orders'),
        api.get('/delivery-staff')
      ]);
      setMetrics(metricsRes.data);

      // Check for new orders
      const currentOrders = ordersRes.data.slice(0, 10);
      const currentOrderIds = new Set(currentOrders.map(o => o.order_id));

      if (previousOrderIds.size > 0) {
        // Find new orders (orders in current but not in previous)
        const newOrders = currentOrders.filter(order => !previousOrderIds.has(order.order_id));

        if (newOrders.length > 0) {
          // Show notification for the first new order
          const newOrder = newOrders[0];
          setNewOrderNotification(newOrder);
          setShowNotification(true);

          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            setShowNotification(false);
          }, 5000);

          // Play notification sound (optional)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi78OScTgwOUKrj8LhjHAU6kdryynksB');
            audio.volume = 0.3;
            audio.play().catch(() => { });
          } catch (e) {
            // Ignore audio errors
          }
        }
      }

      setPreviousOrderIds(currentOrderIds);
      setOrders(currentOrders);
      setStaff(staffRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadSalesData = async () => {
    try {
      setSalesLoading(true);
      let startDate, endDate;
      const today = new Date();

      switch (salesFilter) {
        case 'today':
          startDate = endDate = today.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          startDate = weekStart.toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          break;
        case 'month':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate = monthStart.toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          break;
        case 'custom':
          startDate = customStartDate;
          endDate = customEndDate;
          break;
        default:
          startDate = endDate = today.toISOString().split('T')[0];
      }

      const response = await api.get('/dashboard/sales', {
        params: { start_date: startDate, end_date: endDate }
      });
      setSalesData(response.data);
    } catch (error) {
      console.error('Error loading sales data:', error);
      toast.error('Failed to load sales data');
    } finally {
      setSalesLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  // --- UI Components ---
  const MetricCard = ({ icon: Icon, label, value, color = 'sky', onClick }) => {
    // Dynamic styles based on color - explicit classes for Tailwind JIT
    const styles = {
      emerald: {
        card: 'bg-gradient-to-br from-white to-emerald-50/80 border-emerald-100 hover:border-emerald-200 hover:to-emerald-100/50',
        icon: 'bg-emerald-100 text-emerald-600 ring-emerald-50 group-hover:ring-emerald-100'
      },
      sky: {
        card: 'bg-gradient-to-br from-white to-sky-50/80 border-sky-100 hover:border-sky-200 hover:to-sky-100/50',
        icon: 'bg-sky-100 text-sky-600 ring-sky-50 group-hover:ring-sky-100'
      },
      indigo: {
        card: 'bg-gradient-to-br from-white to-indigo-50/80 border-indigo-100 hover:border-indigo-200 hover:to-indigo-100/50',
        icon: 'bg-indigo-100 text-indigo-600 ring-indigo-50 group-hover:ring-indigo-100'
      },
      rose: {
        card: 'bg-gradient-to-br from-white to-rose-50/80 border-rose-100 hover:border-rose-200 hover:to-rose-100/50',
        icon: 'bg-rose-100 text-rose-600 ring-rose-50 group-hover:ring-rose-100'
      },
    };

    const theme = styles[color] || styles.sky;

    return (
      <div
        onClick={onClick}
        className={`p-6 rounded-3xl border shadow-sm hover:shadow-lg transition-all duration-300 group ${theme.card} ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3.5 rounded-2xl ring-4 transition-all group-hover:scale-110 ${theme.icon}`}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
        </div>
        <div>
          <div className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{value}</div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            {label}
          </div>
        </div>
      </div>
    );
  };

  const StockWidget = () => {
    const percentage = metrics?.total_stock ? ((metrics.available_stock / metrics.total_stock) * 100) : 0;

    // Wave animation Logic
    // We use a large rotating rounded square to simulate waves.
    // The 'top' position controls the fill level.
    // filled = 100% -> top = -50% (approx, covering fully)
    // filled = 0% -> top = 100% (below view)
    // A simple mapping: top = 100 - percentage (refined for visual accuracy)

    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 text-white shadow-2xl shadow-slate-900/20 group">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10">
          <div>
            <div className="flex items-center gap-3 text-sky-400 mb-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
              </span>
              <span className="text-[11px] font-black tracking-[0.2em] uppercase opacity-90">Live Inventory</span>
            </div>

            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-5xl sm:text-7xl font-black tracking-tighter text-white drop-shadow-lg">{metrics?.available_stock || 0}</span>
              <span className="text-xl text-slate-400 font-bold border-l-2 border-slate-700 pl-3"> {metrics?.total_stock || 0} Total</span>
            </div>

            <p className="text-slate-400 font-medium text-sm max-w-[200px] leading-relaxed">
              Cans available in warehouse for immediate dispatch.
            </p>
          </div>

          {/* Water Wave Circle */}
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
            {/* Circle Border Container */}
            <div className="absolute inset-0 rounded-full border-[6px] border-slate-800/50 shadow-inner overflow-hidden bg-slate-900/50 backdrop-blur-sm z-10">

              {/* The Wave (Rotating Rounded Square) */}
              <div
                className="absolute left-1/2 bg-gradient-to-tr from-sky-600 to-sky-400 w-[200%] h-[200%] rounded-[40%] animate-wave-slow transition-all duration-1000 ease-in-out opacity-90"
                style={{
                  top: `${100 - percentage}%`,
                  transform: 'translate(-50%, -50%) rotate(0deg)', // Initial transform, animation handles rotation
                  marginLeft: '-100%', // Center horizontally relative to left-1/2
                  marginTop: hasNaN(percentage) ? '100%' : '0' // Safety fallback
                }}
              />

              {/* Secondary Wave for depth */}
              <div
                className="absolute left-1/2 bg-sky-700/30 w-[200%] h-[200%] rounded-[45%] animate-wave-slower transition-all duration-1000 ease-in-out"
                style={{
                  top: `${100 - percentage - 5}%`,
                  marginLeft: '-100%',
                }}
              />
            </div>

            {/* Percentage Text Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
              <span className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">{Math.round(percentage)}%</span>
              <span className="text-[10px] font-bold text-sky-100 uppercase tracking-widest opacity-80">Full</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper to prevent NaN issues if data isn't loaded
  const hasNaN = (val) => isNaN(val) || val === null || val === undefined;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* New Order Notification Popup */}
      {showNotification && newOrderNotification && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in-right">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 shadow-2xl shadow-emerald-500/30 border-2 border-emerald-400 min-w-[380px] max-w-md relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

            {/* Close button */}
            <button
              onClick={() => setShowNotification(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors z-10"
            >
              <X size={16} className="text-white" />
            </button>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30">
                  <Bell className="text-white animate-pulse" size={24} />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg leading-tight">New Order Received!</h3>
                  <p className="text-emerald-50 text-xs font-bold opacity-90">Just now</p>
                </div>
              </div>

              {/* Order Details */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-black text-xl mb-1">{newOrderNotification.customer_name}</div>
                    <div className="text-emerald-50 text-sm font-medium opacity-90">{newOrderNotification.customer_phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-black text-2xl tracking-tight">₹{newOrderNotification.amount}</div>
                    <div className="text-emerald-50 text-[10px] font-bold uppercase tracking-wider opacity-80">Amount</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 text-emerald-50 text-sm font-bold">
                    <Droplets size={16} className="text-white" />
                    <span>{newOrderNotification.quantity} x {newOrderNotification.litre_size}L</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/40"></div>
                  <div className="text-emerald-50 text-xs font-medium">
                    ID: {newOrderNotification.order_id.split('-')[0]}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  setShowNotification(false);
                  navigate('/orders');
                }}
                className="mt-4 w-full bg-white hover:bg-emerald-50 text-emerald-600 font-black py-3 px-6 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              >
                View Order Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Global Period Selector */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-widest">
            <Calendar size={14} />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {greeting.greeting}, {greeting.vendor_name}
          </h1>
          <p className="text-slate-500 font-medium text-sm sm:text-base">Here's what's happening with your deliveries today.</p>
        </div>

        <div className="bg-white p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-100 shadow-sm shadow-slate-200/50 w-full sm:w-auto">
          {['today', 'week', 'month', 'custom'].map((p) => (
            <button
              key={p}
              onClick={() => setSalesFilter(p)}
              className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${salesFilter === p
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker Panel */}
      {salesFilter === 'custom' && (
        <div className="flex flex-wrap items-center gap-4 p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><Calendar size={18} /></div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="h-8 w-px bg-slate-100 hidden sm:block mx-2"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><Calendar size={18} /></div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
          {salesLoading && <div className="ml-auto animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full"></div>}
        </div>
      )}

      {/* Main Stats (Top - Responsive to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard icon={IndianRupee} label="Total Sale" value={`₹${salesData?.total_revenue || 0}`} color="emerald" />
        <MetricCard icon={Droplets} label="Cans Delivered" value={salesData?.total_cans_sold || 0} color="sky" />
        <MetricCard icon={CheckCircle} label="Completed Orders" value={salesData?.total_orders || 0} color="indigo" />
        <MetricCard
          icon={AlertCircle}
          label="Unpaid Collection"
          value={`₹${salesData?.pending_payment_amount || 0}`}
          color="rose"
          onClick={() => navigate('/orders?payment=pending')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <StockWidget />

          {/* Recent Deliveries */}
          <div className="bg-white rounded-[32px] sm:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg sm:text-xl tracking-tight">Recent Deliveries</h3>
              <Link to="/orders">
                <Button variant="ghost" size="sm" className="font-bold text-sky-600 hover:bg-sky-50">View All</Button>
              </Link>
            </div>
            <div className="p-4 sm:p-6">
              {orders.map((order, idx) => (
                <div key={order.order_id} className="flex gap-4 group cursor-pointer" onClick={() => navigate('/orders')}>
                  {/* Timeline Track */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10 ${order.status === 'delivered' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}></div>
                    {idx !== orders.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1"></div>}
                  </div>

                  {/* Card Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl transition-all shadow-sm group-hover:shadow-md group-hover:border-slate-200 group-hover:-translate-y-0.5 relative overflow-hidden">
                      {/* Status Strip */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${order.status === 'delivered' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>

                      {/* Left Info */}
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black border transition-colors ${order.status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                          {order.quantity}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base leading-tight">{order.customer_name}</h4>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1">
                            <Clock size={12} className="text-slate-300" />
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className={order.payment_status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}>
                              {order.payment_status === 'paid' ? 'Paid' : 'Pending Pay'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Info */}
                      <div className="text-right">
                        <div className="font-black text-slate-900 text-lg leading-tight">₹{order.amount}</div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-0.5">
                          {order.delivery_staff_name ? (
                            <span className="flex items-center justify-end gap-1">
                              <TruckIcon size={10} /> {order.delivery_staff_name.split(' ')[0]}
                            </span>
                          ) : (
                            <span className="text-amber-500">Unassigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Info Rail */}
        <div className="space-y-8">
          {/* Total Lifetime Revenue Card (Explicitly Below Today Sale) */}
          <div className="p-6 sm:p-8 bg-slate-900 rounded-[32px] sm:rounded-[40px] border border-slate-800 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-emerald-400">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block">Historical</span>
                <span className="text-lg font-black text-white tracking-tight">Lifetime Revenue</span>
              </div>
            </div>
            <div className="text-5xl font-black text-white relative z-10 tracking-tighter leading-none mb-2">₹{metrics?.total_revenue || 0}</div>
            <div className="text-sm font-bold text-slate-500 relative z-10">Cumulative business revenue</div>
          </div>

          {/* Team Widget */}
          <div className="bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 text-xl tracking-tight">Delivery Team</h3>
              <Badge variant="premium" className="text-[10px] py-1 px-3 uppercase tracking-widest">{staff.length} Total</Badge>
            </div>
            <div className="space-y-6">
              {staff.slice(0, 5).map(s => (
                <div key={s.staff_id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors">
                      {s.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                      <div className="text-xs text-slate-400 font-medium">{s.active_orders_count > 0 ? 'Out for delivery' : 'Steady'}</div>
                    </div>
                  </div>
                  {s.active_orders_count > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-8 text-sm font-black text-slate-400 hover:text-sky-600 uppercase tracking-widest" onClick={() => navigate('/delivery')}>Manage Team</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
