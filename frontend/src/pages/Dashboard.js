import { useState, useEffect } from 'react';
import { api } from '../App';
import { Package, TruckIcon, IndianRupee, Droplets, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const MetricCard = ({ icon: Icon, label, value, subtitle, color = 'sky' }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow" data-testid={`metric-card-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 bg-${color}-50 rounded-xl flex items-center justify-center`}>
          <Icon className={`text-${color}-600`} size={20} strokeWidth={1.5} />
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-600 font-medium">{label}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );

  const StockCard = () => (
    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden" data-testid="stock-card">
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Droplets className="text-sky-400" size={24} />
            </div>
            <div>
              <div className="text-sm text-slate-400">Available Stock</div>
              <div className="text-4xl font-bold mt-1">{metrics?.available_stock || 0}</div>
            </div>
          </div>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500"
            style={{ width: `${((metrics?.available_stock || 0) / (metrics?.total_stock || 1)) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-slate-400">
          <span>Out of {metrics?.total_stock || 0} cans</span>
          <span>{Math.round(((metrics?.available_stock || 0) / (metrics?.total_stock || 1)) * 100)}%</span>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl" />
    </div>
  );

  const OrderCard = ({ order }) => {
    const statusColors = {
      pending: 'amber',
      delivered: 'emerald',
      cancelled: 'red'
    };
    const color = statusColors[order.status] || 'slate';

    return (
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-sky-200 transition-colors group" data-testid={`order-card-${order.order_id}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-semibold text-slate-900">{order.customer_name}</div>
            <div className="text-sm text-slate-500">{order.order_id}</div>
          </div>
          <span className={`bg-${color}-50 text-${color}-700 border border-${color}-100 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide`}>
            {order.status}
          </span>
        </div>
        <div className="text-sm text-slate-600 mb-2">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} />
            <span>{order.quantity} cans × ₹50 = ₹{order.amount}</span>
          </div>
          <div className="flex items-center gap-2">
            <TruckIcon size={14} />
            <span>{order.delivery_staff_name}</span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className={`text-xs font-medium ${
            order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {order.payment_status === 'paid' ? '✓ Paid' : '○ Pending Payment'}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  };

  const StaffSection = ({ staffMember }) => {
    const staffOrders = orders.filter(o => o.delivery_staff_id === staffMember.staff_id);
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid={`staff-section-${staffMember.staff_id}`}>
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
                <TruckIcon className="text-sky-600" size={18} />
              </div>
              <div>
                <div className="font-semibold text-slate-900">{staffMember.name}</div>
                <div className="text-xs text-slate-500">{staffOrders.length} orders today</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-sky-600">{staffMember.active_orders_count}</div>
              <div className="text-xs text-slate-500">Active</div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {staffOrders.length > 0 ? (
            staffOrders.slice(0, 3).map(order => <OrderCard key={order.order_id} order={order} />)
          ) : (
            <div className="text-center py-6 text-slate-500 text-sm">No orders yet</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-600 mt-1">Today's Overview</p>
        </div>
      </div>

      <StockCard />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Package} label="Total Orders" value={metrics?.total_orders || 0} />
        <MetricCard icon={CheckCircle} label="Delivered" value={metrics?.delivered_orders || 0} color="emerald" />
        <MetricCard icon={Clock} label="Pending" value={metrics?.pending_orders || 0} color="amber" />
        <MetricCard icon={Droplets} label="Cans Sold" value={metrics?.total_cans || 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" data-testid="revenue-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <IndianRupee className="text-emerald-600" size={20} />
            </div>
            <div>
              <div className="text-sm text-slate-600">Total Revenue</div>
              <div className="text-2xl font-bold text-slate-900">₹{metrics?.total_revenue || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" data-testid="pending-payment-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <AlertCircle className="text-amber-600" size={20} />
            </div>
            <div>
              <div className="text-sm text-slate-600">Pending Payment</div>
              <div className="text-2xl font-bold text-slate-900">₹{metrics?.pending_payment || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {staff.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Delivery Staff</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staff.map(s => <StaffSection key={s.staff_id} staffMember={s} />)}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200" data-testid="no-orders-message">
          <Package className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders yet today</h3>
          <p className="text-slate-600">Orders will appear here once customers start ordering via WhatsApp</p>
        </div>
      )}
    </div>
  );
}
