import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Package, TruckIcon, IndianRupee, Droplets, CheckCircle, Clock, AlertCircle, Calendar, Filter, TrendingUp, Users, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import Card, { GlassCard } from '../components/ui/card';
import Button from '../components/ui/button';
import Badge from '../components/ui/badge';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);

  // Sales filter state
  const [salesData, setSalesData] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesFilter, setSalesFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSalesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesFilter, customStartDate, customEndDate]);

  const loadData = async () => {
    try {
      const [metricsRes, ordersRes, staffRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/orders'),
        api.get('/delivery-staff')
      ]);
      setMetrics(metricsRes.data);
      setOrders(ordersRes.data);
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
          if (!customStartDate || !customEndDate) {
            setSalesLoading(false);
            return;
          }
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
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  // --- Sub-components ---

  const MetricCard = ({ icon: Icon, label, value, subtitle, color = 'sky', trend }) => (
    <Card className="hover:scale-[1.02] transition-transform duration-300" data-testid={`metric-card-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl bg-${color}-50 text-${color}-600`}>
          <Icon size={24} strokeWidth={2} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <TrendingUp size={12} />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
        <div className="text-sm font-medium text-slate-500 mt-1">{label}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-2">{subtitle}</div>}
      </div>
    </Card>
  );

  const StockWidget = () => (
    <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-2xl" data-testid="stock-card">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-sky-400 mb-1">
              <Droplets size={20} />
              <span className="text-sm font-bold tracking-wider uppercase">Live Inventory</span>
            </div>
            <h3 className="text-4xl font-black mt-2">{metrics?.available_stock || 0}</h3>
            <p className="text-slate-400 text-sm">Cans available for delivery</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
            <span className="text-2xl font-bold">{Math.round(((metrics?.available_stock || 0) / (metrics?.total_stock || 1)) * 100)}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_15px_rgba(56,189,248,0.5)] transition-all duration-1000 ease-out"
            style={{ width: `${((metrics?.available_stock || 0) / (metrics?.total_stock || 1)) * 100}%` }}
          />
        </div>

        <div className="flex justify-between mt-3 text-sm font-medium text-slate-400">
          <span>0</span>
          <span>Capacity: {metrics?.total_stock || 0}</span>
        </div>
      </div>
    </div>
  );

  const OrderListItem = ({ order }) => {
    const statusConfig = {
      pending: { color: 'amber', icon: Clock },
      delivered: { color: 'emerald', icon: CheckCircle },
      cancelled: { color: 'red', icon: AlertCircle }
    };
    const config = statusConfig[order.status] || { color: 'slate', icon: Package };
    const StatusIcon = config.icon;

    return (
      <div className="group flex items-center justify-between p-4 bg-slate-50/50 hover:bg-white border boundary-transparent hover:border-slate-100 rounded-2xl transition-all duration-200" data-testid={`order-card-${order.order_id}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm group-hover:shadow-md transition-shadow text-${config.color}-500`}>
            <Package size={20} />
          </div>
          <div>
            <div className="font-bold text-slate-900">{order.customer_name}</div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{order.order_id}</span>
              <span>•</span>
              <span>{order.quantity} cans (₹{order.amount})</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <Badge variant={order.status === 'delivered' ? 'success' : order.status === 'pending' ? 'warning' : 'error'}>
            {order.status}
          </Badge>
          <div className="text-xs text-slate-400 mt-1.5">
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1">Overview of your water delivery business</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
          <Calendar size={16} />
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Stats & Stock (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard icon={Package} label="Total Orders" value={metrics?.total_orders || 0} />
            <MetricCard icon={CheckCircle} label="Delivered" value={metrics?.delivered_orders || 0} color="emerald" />
            <MetricCard icon={Clock} label="Pending" value={metrics?.pending_orders || 0} color="amber" />
            <MetricCard icon={Droplets} label="Cans Sold" value={metrics?.total_cans || 0} color="blue" />
          </div>

          <StockWidget />

          {/* Sales Section */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Sales Report</h3>
                  <div className="text-xs text-slate-500">Revenue and order analytics</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={salesFilter}
                  onChange={(e) => setSalesFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-100 cursor-pointer"
                  data-testid="sales-filter-select"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Custom Date Inputs */}
            {salesFilter === 'custom' && (
              <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 rounded-2xl">
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="bg-white border-0 rounded-lg shadow-sm text-sm px-3 py-2" />
                <span className="text-slate-400">to</span>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="bg-white border-0 rounded-lg shadow-sm text-sm px-3 py-2" />
              </div>
            )}

            {salesLoading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div></div>
            ) : salesData ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-violet-50/50 rounded-2xl border border-violet-100">
                  <div className="text-sm text-violet-600 font-medium mb-1">Total Revenue</div>
                  <div className="text-3xl font-black text-violet-700">₹{salesData.total_revenue}</div>
                </div>
                <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <div className="text-sm text-amber-600 font-medium mb-1">Pending Payment</div>
                  <div className="text-3xl font-black text-amber-700">₹{salesData.pending_payment_orders}</div>
                </div>
                <div className="col-span-2 grid grid-cols-4 gap-2 pt-2">
                  <div className="text-center p-3 bg-slate-50 rounded-xl">
                    <div className="text-lg font-bold text-slate-700">{salesData.total_orders}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Orders</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl">
                    <div className="text-lg font-bold text-slate-700">{salesData.total_cans_sold}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Cans</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl">
                    <div className="text-lg font-bold text-slate-700">{salesData.paid_orders}</div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500">Paid</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl">
                    <div className="text-lg font-bold text-slate-700">{salesData.pending_payment_orders}</div>
                    <div className="text-[10px] uppercase font-bold text-amber-500">Unpaid</div>
                  </div>
                </div>
              </div>
            ) : <div className="text-center py-8 text-slate-400">No data available</div>}
          </Card>
        </div>

        {/* Right Column: Staff & Recent (Span 1) */}
        <div className="space-y-6">
          {/* Staff Status */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Delivery Team</h3>
              <Badge variant="info">{staff.filter(s => s.active_orders_count > 0).length} Active</Badge>
            </div>
            <div className="space-y-3">
              {staff.slice(0, 4).map(s => (
                <div key={s.staff_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                      {s.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm text-slate-700">{s.name}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-400">{s.active_orders_count} orders</div>
                </div>
              ))}
              {staff.length === 0 && <div className="text-sm text-slate-400 text-center py-2">No active staff</div>}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-sm" size="sm">View All Team <ArrowUpRight size={14} /></Button>
          </Card>

          {/* Financials Summary */}
          <div className="grid grid-cols-1 gap-4">
            <div className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-slate-500">
                <IndianRupee size={18} />
                <span className="text-sm font-medium">Total Revenue</span>
              </div>
              <div className="text-2xl font-black text-slate-900">₹{metrics?.total_revenue || 0}</div>
            </div>
            <div className="p-5 bg-white rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="flex items-center gap-3 mb-2 text-amber-600 relative z-10">
                <AlertCircle size={18} />
                <span className="text-sm font-bold">Outstanding</span>
              </div>
              <div className="text-2xl font-black text-slate-900 relative z-10">₹{metrics?.pending_payment || 0}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
