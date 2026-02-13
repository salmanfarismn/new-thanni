import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Package, TruckIcon, Filter, Search, CheckCircle, XCircle, IndianRupee, RefreshCw, Bell, Calendar, ChevronDown, MoreHorizontal, Eye, Clock, Users, Plus, Minus, User, MapPin, Hash, AlertCircle, Droplets, PhoneCall, MessageCircle, CreditCard, Wallet, Banknote, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';
import Button from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';

// Payment status constants
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID_CASH: 'paid_cash',
  PAID_UPI: 'paid_upi',
  UPI_PENDING: 'upi_pending',
  CASH_DUE: 'cash_due',
  DELIVERED_UNPAID: 'delivered_unpaid',
  PAID: 'paid' // Legacy status
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [outstandingSummary, setOutstandingSummary] = useState(null);
  const [newOrder, setNewOrder] = useState({
    customer_phone: '',
    customer_name: '',
    customer_address: '',
    litre_size: 20,
    quantity: 1
  });
  const [deliveryAgents, setDeliveryAgents] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [newAgentId, setNewAgentId] = useState('');

  // Handle URL parameters for filtering
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    const paymentParam = params.get('payment');

    if (statusParam && ['pending', 'delivered', 'cancelled'].includes(statusParam)) {
      setFilter(statusParam);
    } else if (paymentParam === 'pending') {
      setFilter('pending-payment');
    } else if (paymentParam === 'upi_pending') {
      setFilter('upi-pending');
    } else if (paymentParam === 'cash_due') {
      setFilter('cash-due');
    } else if (paymentParam === 'unpaid') {
      setFilter('unpaid');
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadOutstandingSummary();
    const interval = setInterval(() => {
      loadOrders();
      loadOutstandingSummary();
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    loadDeliveryAgents();
  }, []);

  const loadDeliveryAgents = async () => {
    try {
      const response = await api.get('/delivery-staff');
      setDeliveryAgents(response.data.filter(agent => agent.is_active !== false));
    } catch (error) {
      console.error('Error loading delivery agents:', error);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      // Only send status filter for actual order statuses, not payment filters
      if (filter !== 'all' && !['pending-payment', 'upi-pending', 'cash-due', 'unpaid'].includes(filter)) {
        params.status = filter;
      }
      const response = await api.get('/orders', { params });
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOutstandingSummary = async () => {
    try {
      const response = await api.get('/orders/outstanding/summary');
      setOutstandingSummary(response.data);
    } catch (error) {
      console.error('Error loading outstanding summary:', error);
    }
  };

  const updateOrderStatus = async (orderId, status, paymentStatus = null, paymentMethod = null, emptyCans = null) => {
    try {
      const payload = { order_id: orderId, status };
      if (paymentStatus) payload.payment_status = paymentStatus;
      if (paymentMethod) payload.payment_method = paymentMethod;
      if (emptyCans !== null) payload.empty_cans_collected = emptyCans;

      await api.put(`/orders/${orderId}/status`, payload);
      toast.success(`Order ${status}!`);
      loadOrders();
      loadOutstandingSummary();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const confirmPayment = async (orderId, paymentStatus) => {
    try {
      await api.post(`/orders/${orderId}/payment/confirm`, null, {
        params: { payment_status: paymentStatus }
      });
      toast.success('Payment confirmed!');
      loadOrders();
      loadOutstandingSummary();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to confirm payment');
    }
  };

  const retryNotification = async (orderId) => {
    try {
      await api.post(`/orders/${orderId}/retry-notification`);
      toast.success('Notification queued for retry');
      loadOrders();
    } catch (error) {
      console.error('Error retrying notification:', error);
      toast.error('Failed to retry notification');
    }
  };

  const reassignOrder = async () => {
    if (!newAgentId) {
      toast.error('Please select an agent');
      return;
    }

    try {
      setReassigning(true);
      await api.put(`/orders/${selectedOrder.order_id}/reassign`, null, {
        params: { new_staff_id: newAgentId }
      });
      toast.success('Order reassigned successfully!');
      setIsReassignModalOpen(false);
      setNewAgentId('');
      loadOrders();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error reassigning order:', error);
      toast.error(error.response?.data?.detail || 'Failed to reassign order');
    } finally {
      setReassigning(false);
    }
  };

  const createManualOrder = async () => {
    try {
      // Validate inputs
      if (!newOrder.customer_phone || !newOrder.customer_name || !newOrder.customer_address) {
        toast.error('Please fill in all customer details');
        return;
      }

      if (newOrder.quantity < 1 || newOrder.quantity > 10) {
        toast.error('Quantity must be between 1 and 10');
        return;
      }

      setIsCreating(true);
      await api.post('/orders', newOrder);
      toast.success('Order created successfully!');
      setIsCreateDialogOpen(false);
      setNewOrder({
        customer_phone: '',
        customer_name: '',
        customer_address: '',
        litre_size: 20,
        quantity: 1
      });
      loadOrders();
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone.includes(searchTerm);

    // Handle payment filters
    if (filter === 'pending-payment') {
      return matchesSearch && ['pending', 'delivered_unpaid'].includes(order.payment_status);
    }
    if (filter === 'upi-pending') {
      return matchesSearch && order.payment_status === PAYMENT_STATUS.UPI_PENDING;
    }
    if (filter === 'cash-due') {
      return matchesSearch && order.payment_status === PAYMENT_STATUS.CASH_DUE;
    }
    if (filter === 'unpaid') {
      return matchesSearch && [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.UPI_PENDING, PAYMENT_STATUS.CASH_DUE, PAYMENT_STATUS.DELIVERED_UNPAID].includes(order.payment_status);
    }
    if (filter === 'paid') {
      return matchesSearch && [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PAID_CASH, PAYMENT_STATUS.PAID_UPI].includes(order.payment_status);
    }

    return matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'delivered': return <Badge variant="success"> Delivered </Badge>;
      case 'pending': return <Badge variant="warning"> Pending </Badge>;
      case 'out_for_delivery': return <Badge variant="info"> On the Way </Badge>;
      case 'in_queue': return <Badge variant="secondary"> In Queue </Badge>;
      case 'assigned': return <Badge variant="secondary"> Assigned </Badge>;
      case 'cancelled': return <Badge variant="error"> Cancelled </Badge>;
      default: return <Badge> {status} </Badge>;
    }
  };

  const getPaymentBadge = (status, method, amountDue) => {
    switch (status) {
      case PAYMENT_STATUS.PAID:
      case PAYMENT_STATUS.PAID_CASH:
        return (
          <Badge variant="success" className="gap-1">
            <Banknote size={10} /> Cash Paid
          </Badge>
        );
      case PAYMENT_STATUS.PAID_UPI:
        return (
          <Badge variant="success" className="gap-1">
            <CreditCard size={10} /> UPI Paid
          </Badge>
        );
      case PAYMENT_STATUS.UPI_PENDING:
        return (
          <Badge variant="info" className="gap-1 bg-purple-100 text-purple-700 border-purple-200">
            <CreditCard size={10} /> UPI Pending
          </Badge>
        );
      case PAYMENT_STATUS.CASH_DUE:
        return (
          <Badge variant="warning" className="gap-1 bg-orange-100 text-orange-700 border-orange-200">
            <Wallet size={10} /> Cash Due
          </Badge>
        );
      case PAYMENT_STATUS.DELIVERED_UNPAID:
        return (
          <Badge variant="error" className="gap-1 bg-red-100 text-red-700 border-red-200">
            <AlertCircle size={10} /> Unpaid
          </Badge>
        );
      case PAYMENT_STATUS.PENDING:
      default:
        return (
          <Badge variant="warning" className="gap-1">
            <Clock size={10} /> Pending
          </Badge>
        );
    }
  };

  // Helper to check if payment is unpaid
  const isUnpaidStatus = (status) => {
    return [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.UPI_PENDING, PAYMENT_STATUS.CASH_DUE, PAYMENT_STATUS.DELIVERED_UNPAID].includes(status);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10" data-testid="orders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Orders</h1>
          <p className="text-slate-500 font-medium mt-1">Manage and track your water deliveries</p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2 bg-slate-900 border-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10 py-4 px-6 sm:py-6 sm:px-10 rounded-[28px] text-base sm:text-lg font-black transition-all active:scale-95"
        >
          <Plus size={20} className="stroke-[3]" /> New Delivery
        </Button>
      </div>

      {/* Outstanding Summary Section */}
      {outstandingSummary && outstandingSummary.total_due > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg"><IndianRupee size={18} /></div>
              <span className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Outstanding Summary</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {/* Total Due */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <div className="text-[10px] font-black uppercase opacity-60 mb-1">Total Due</div>
                <div className="text-2xl sm:text-3xl font-black tracking-tighter">₹{outstandingSummary.total_due?.toLocaleString()}</div>
                <div className="text-xs opacity-60 mt-1">{outstandingSummary.total_orders} orders</div>
              </div>

              {/* UPI Pending */}
              <button
                onClick={() => setFilter('upi-pending')}
                className={`bg-purple-500/20 backdrop-blur-md rounded-2xl p-4 border border-purple-400/20 text-left transition-all hover:scale-[1.02] ${filter === 'upi-pending' ? 'ring-2 ring-purple-400' : ''}`}
              >
                <div className="text-[10px] font-black uppercase opacity-60 mb-1 flex items-center gap-1"><CreditCard size={10} /> UPI Pending</div>
                <div className="text-xl sm:text-2xl font-black tracking-tighter">₹{outstandingSummary.upi_pending_amount?.toLocaleString()}</div>
                <div className="text-xs opacity-60 mt-1">{outstandingSummary.upi_pending_orders} orders</div>
              </button>

              {/* Cash Due */}
              <button
                onClick={() => setFilter('cash-due')}
                className={`bg-orange-500/20 backdrop-blur-md rounded-2xl p-4 border border-orange-400/20 text-left transition-all hover:scale-[1.02] ${filter === 'cash-due' ? 'ring-2 ring-orange-400' : ''}`}
              >
                <div className="text-[10px] font-black uppercase opacity-60 mb-1 flex items-center gap-1"><Wallet size={10} /> Cash Due</div>
                <div className="text-xl sm:text-2xl font-black tracking-tighter">₹{outstandingSummary.cash_due_amount?.toLocaleString()}</div>
                <div className="text-xs opacity-60 mt-1">{outstandingSummary.cash_due_orders} orders</div>
              </button>

              {/* Delivered Unpaid */}
              <button
                onClick={() => setFilter('unpaid')}
                className={`bg-red-500/20 backdrop-blur-md rounded-2xl p-4 border border-red-400/20 text-left transition-all hover:scale-[1.02] ${filter === 'unpaid' ? 'ring-2 ring-red-400' : ''}`}
              >
                <div className="text-[10px] font-black uppercase opacity-60 mb-1 flex items-center gap-1"><AlertCircle size={10} /> Unpaid</div>
                <div className="text-xl sm:text-2xl font-black tracking-tighter">₹{outstandingSummary.delivered_unpaid_amount?.toLocaleString()}</div>
                <div className="text-xs opacity-60 mt-1">{outstandingSummary.delivered_unpaid_orders} orders</div>
              </button>
            </div>
          </div>
        </div>
      )}



      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">

        {/* Left Side Filter Panel (Desktop) */}
        <div className="hidden lg:block lg:w-72 flex-shrink-0 space-y-6">
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm sticky top-24">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 pl-2">Filter Orders</h3>

            <div className="space-y-1">
              {[
                { id: 'all', label: 'All Orders', icon: Package },
                { id: 'pending', label: 'Pending', icon: Clock },
                { id: 'delivered', label: 'Delivered', icon: CheckCircle },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group ${filter === item.id
                    ? 'bg-sky-50 text-sky-600 shadow-inner'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = item.icon;
                      return <Icon size={18} strokeWidth={filter === item.id ? 3 : 2} className={filter === item.id ? 'text-sky-500' : 'text-slate-400 group-hover:text-slate-600'} />;
                    })()}
                    {item.label}
                  </div>
                  {filter === item.id && <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>}
                </button>
              ))}
            </div>

            {/* Payment Status Filters */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2">Payment Status</h3>
              <div className="space-y-1">
                {[
                  { id: 'paid', label: 'Paid', icon: CheckCircle, color: 'emerald' },
                  { id: 'upi-pending', label: 'UPI Pending', icon: CreditCard, color: 'purple' },
                  { id: 'cash-due', label: 'Cash Due', icon: Wallet, color: 'orange' },
                  { id: 'unpaid', label: 'All Unpaid', icon: AlertCircle, color: 'red' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${filter === item.id
                      ? `bg-${item.color}-50 text-${item.color}-600 shadow-inner`
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    style={filter === item.id ? {
                      backgroundColor: item.color === 'emerald' ? '#ecfdf5' : item.color === 'purple' ? '#faf5ff' : item.color === 'orange' ? '#fff7ed' : '#fef2f2',
                      color: item.color === 'emerald' ? '#059669' : item.color === 'purple' ? '#9333ea' : item.color === 'orange' ? '#ea580c' : '#dc2626'
                    } : {}}
                  >
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = item.icon;
                        return <Icon size={16} strokeWidth={filter === item.id ? 3 : 2} />;
                      })()}
                      {item.label}
                    </div>
                    {filter === item.id && <div className="w-1.5 h-1.5 rounded-full" style={{
                      backgroundColor: item.color === 'emerald' ? '#10b981' : item.color === 'purple' ? '#a855f7' : item.color === 'orange' ? '#f97316' : '#ef4444'
                    }}></div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2">Summary</div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-500 mb-1">Total Found</div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">{filteredOrders.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Main Content */}
        <div className="flex-1 space-y-8">

          {/* Mobile Filters */}
          <div className="lg:hidden flex overflow-x-auto gap-2 pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { id: 'all', label: 'All', icon: Package },
              { id: 'pending', label: 'Pending', icon: Clock },
              { id: 'delivered', label: 'Delivered', icon: CheckCircle },
              { id: 'unpaid', label: 'Unpaid', icon: AlertCircle, color: 'red-500' },
              { id: 'upi-pending', label: 'UPI Wait', icon: CreditCard, color: 'purple-500' },
              { id: 'cash-due', label: 'Cash Due', icon: Wallet, color: 'orange-500' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${filter === item.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                  : 'bg-white text-slate-500 border-slate-200'
                  }`}
              >
                {(() => {
                  const Icon = item.icon;
                  return <Icon size={14} className={filter === item.id ? 'text-white' : (item.color ? `text-${item.color}` : 'text-slate-400')} />;
                })()}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Collection Dashboard Summary (Contextual) */}
          {['pending-payment', 'upi-pending', 'cash-due', 'unpaid'].includes(filter) && (
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[24px] sm:rounded-[40px] p-5 sm:p-10 text-white shadow-xl shadow-amber-500/20 relative overflow-hidden animate-in slide-in-from-top-4 duration-500">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
                <div className="text-center md:text-left w-full sm:w-auto">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2 sm:mb-4">
                    <div className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg"><IndianRupee size={16} className="sm:w-5 sm:h-5" /></div>
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] opacity-80">Collection Dashboard</span>
                  </div>
                  <div className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter mb-2 drop-shadow-sm">₹{filteredOrders.reduce((sum, o) => sum + (o.amount || 0), 0).toLocaleString()}</div>
                  <p className="text-amber-100 font-medium text-xs sm:text-lg">Pending collection across {filteredOrders.length} accounts</p>
                </div>

                {/* Mobile Stats Grid inside Card */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full md:w-auto">
                  <div className="px-4 py-3 sm:px-8 sm:py-6 bg-amber-950/20 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/10 text-center shadow-inner">
                    <div className="text-[10px] font-black uppercase opacity-60 mb-0.5 sm:mb-1">Total Orders</div>
                    <div className="text-xl sm:text-4xl font-black">{filteredOrders.length}</div>
                  </div>
                  <div className="px-4 py-3 sm:px-8 sm:py-6 bg-amber-950/20 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/10 text-center shadow-inner">
                    <div className="text-[10px] font-black uppercase opacity-60 mb-0.5 sm:mb-1">Cans</div>
                    <div className="text-xl sm:text-4xl font-black">{filteredOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search & Toolstrip */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Search by customer name, phone or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-8 py-5 bg-white border border-slate-100 rounded-[28px] text-sm font-bold shadow-sm focus:outline-none focus:ring-4 focus:ring-sky-500/5 focus:border-sky-300 transition-all placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="space-y-4">
            {/* Desktop View: Interactive Table */}
            <div className="hidden lg:block bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
                    <TableHead className="py-6 pl-8 font-black text-slate-400 text-[11px] uppercase tracking-widest">Order Info</TableHead>
                    <TableHead className="font-black text-slate-400 text-[11px] uppercase tracking-widest">Customer</TableHead>
                    <TableHead className="font-black text-slate-400 text-[11px] uppercase tracking-widest text-center">Amount</TableHead>
                    <TableHead className="font-black text-slate-400 text-[11px] uppercase tracking-widest">Status</TableHead>
                    <TableHead className="pr-8 text-right font-black text-slate-400 text-[11px] uppercase tracking-widest">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-64 text-center"><RefreshCw className="animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow
                      key={order.order_id}
                      className="group hover:bg-slate-50 hover:scale-[1.01] transition-all duration-200 cursor-pointer border-b border-slate-50"
                      onClick={() => { setSelectedOrder(order); setIsDialogOpen(true); }}
                    >
                      <TableCell className="py-6 pl-8">
                        <div className="font-mono text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded w-fit mb-1">{order.order_id}</div>
                        <div className="text-xs font-bold text-slate-400">{new Date(order.created_at).toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-black text-slate-900">{order.customer_name}</div>
                        <div className="text-xs font-bold text-slate-400">{order.customer_phone}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-lg font-black text-slate-900 leading-none mb-1">₹{order.amount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.quantity} x {order.litre_size}L</div>
                        {order.amount_due > 0 && (
                          <div className="text-[10px] font-bold text-red-500 mt-1">Due: ₹{order.amount_due}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-start">
                          {getStatusBadge(order.status)}
                          {getPaymentBadge(order.payment_status, order.payment_method, order.amount_due)}
                        </div>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-sky-500 group-hover:text-white transition-all ml-auto focus:ring-4 ring-sky-100">
                          <Eye size={18} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View: Cards (Updated to match dashboard style) */}
            <div className="lg:hidden space-y-4">
              {loading ? (
                <div className="py-20 text-center"><RefreshCw className="animate-spin mx-auto h-10 w-10 text-slate-200" /></div>
              ) : filteredOrders.map((order) => (
                <div
                  key={order.order_id}
                  onClick={() => { setSelectedOrder(order); setIsDialogOpen(true); }}
                  className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${order.status === 'delivered' ? 'bg-emerald-500' : isUnpaidStatus(order.payment_status) ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 tracking-tighter bg-slate-100 px-2 py-1 rounded uppercase mb-2 w-fit">{order.order_id}</div>
                      <h4 className="font-black text-slate-900 text-xl tracking-tight leading-none">{order.customer_name}</h4>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="flex justify-between items-end pt-6 border-t border-slate-50">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                        <Droplets size={14} className="text-sky-500" /> {order.quantity} x {order.litre_size}L
                      </div>
                      {getPaymentBadge(order.payment_status, order.payment_method, order.amount_due)}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">₹{order.amount}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {isUnpaidStatus(order.payment_status) ? 'Due' : 'Total'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* Order Details Modal (Dialog) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] bg-white rounded-[32px] p-0 overflow-hidden border-0 shadow-2xl flex flex-col">
          <DialogHeader className="p-6 pb-4 flex-shrink-0 bg-white border-b border-slate-50">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              Order Details
              {selectedOrder && <Badge variant="secondary" className="text-[10px] font-mono bg-slate-100 text-slate-500">#{selectedOrder.order_id.slice(-6)}</Badge>}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Customer Info Card */}
                <div className="bg-slate-50 rounded-[24px] p-4 border border-slate-100 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow-sm text-slate-500">
                      <Users size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-tight text-lg">{selectedOrder.customer_name}</h4>
                      <p className="text-sm text-slate-500 font-medium">{selectedOrder.customer_phone}</p>
                    </div>
                  </div>

                  {/* Contact Actions */}
                  <div className="grid grid-cols-3 gap-3">
                    <a
                      href={`tel:${selectedOrder.customer_phone?.startsWith('+') ? selectedOrder.customer_phone : '+91' + selectedOrder.customer_phone?.replace(/\D/g, '').replace(/^91/, '')}`}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs shadow-sm active:scale-95 transition-transform"
                    >
                      <PhoneCall size={14} /> Call
                    </a>
                    <a
                      href={`https://wa.me/91${selectedOrder.customer_phone?.replace(/\D/g, '').replace(/^91/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold text-xs shadow-sm active:scale-95 transition-transform"
                    >
                      <MessageCircle size={14} /> Chat
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedOrder.customer_address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs shadow-sm active:scale-95 transition-transform"
                    >
                      <Navigation size={14} /> Navigate
                    </a>
                  </div>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedOrder.customer_address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 text-sm text-slate-600 font-medium leading-snug hover:bg-slate-50 transition-colors"
                  >
                    <MapPin size={16} className="mt-0.5 text-slate-400 flex-shrink-0" />
                    {selectedOrder.customer_address}
                    <span className="ml-auto text-[10px] font-bold text-blue-500 uppercase tracking-wider">Map ↗</span>
                  </a>
                </div>

                {/* Order Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {isUnpaidStatus(selectedOrder.payment_status) ? 'Amount Due' : 'Total'}
                    </div>
                    <div className={`text-2xl font-black ${isUnpaidStatus(selectedOrder.payment_status) ? 'text-red-600' : 'text-slate-900'}`}>
                      ₹{selectedOrder.amount_due || selectedOrder.amount}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity</div>
                    <div className="text-2xl font-black text-slate-900">{selectedOrder.quantity} <span className="text-sm font-medium text-slate-400">cans</span></div>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                    <IndianRupee size={14} /> Payment
                  </span>
                  {getPaymentBadge(selectedOrder.payment_status, selectedOrder.payment_method, selectedOrder.amount_due)}
                </div>

                {/* Notification Status */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                    <Bell size={14} /> Notification
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedOrder.notification_status === 'failed' && (
                      <Button variant="ghost" size="sm" onClick={() => retryNotification(selectedOrder.order_id)} className="text-sky-500 h-6 px-2 text-xs font-bold">
                        Retry <RefreshCw size={10} className="ml-1" />
                      </Button>
                    )}
                    <Badge className={`${selectedOrder.notification_status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'} border-none shadow-none`}>
                      {selectedOrder.notification_status || 'queued'}
                    </Badge>
                  </div>
                </div>

                {/* Delivery Proof Photo */}
                {selectedOrder.delivery_photo_url && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Delivery Proof</h4>
                    <div className="relative rounded-2xl overflow-hidden border-2 border-slate-100 group">
                      <img
                        src={`${api.defaults.baseURL.replace('/api', '')}${selectedOrder.delivery_photo_url}`}
                        alt="Delivery Proof"
                        className="w-full h-48 object-cover bg-slate-50"
                        onClick={() => window.open(`${api.defaults.baseURL.replace('/api', '')}${selectedOrder.delivery_photo_url}`, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors cursor-pointer flex items-center justify-center">
                        <div className="bg-white/90 backdrop-blur rounded-full px-3 py-1.5 text-xs font-bold text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 shadow-sm">
                          <Eye size={12} /> View Full
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Actions Footer */}
              <div className="p-4 bg-white border-t border-slate-50 flex-shrink-0 z-20">
                {['pending', 'assigned', 'in_queue'].includes(selectedOrder.status) && (
                  <Button
                    variant="ghost"
                    className="w-full mb-4 rounded-xl h-12 font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 border-none flex items-center justify-center gap-2 shadow-sm"
                    onClick={() => {
                      setIsReassignModalOpen(true);
                      setNewAgentId(selectedOrder.delivery_staff_id || '');
                    }}
                  >
                    <Users size={18} /> Reassign Agent
                  </Button>
                )}
                {selectedOrder.status === 'pending' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Complete Order</p>

                    <div className="grid grid-cols-2 gap-3">

                      <Button variant="primary" className="bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 h-auto py-3 flex-col gap-0.5 rounded-xl border-none" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered', 'paid_cash', 'cash')}>
                        <span className="text-xs font-medium opacity-90">Payment: Cash</span>
                        <span className="text-sm font-black">Delivered</span>
                      </Button>
                      <Button variant="accent" className="bg-sky-500 hover:bg-sky-600 shadow-lg shadow-sky-500/20 h-auto py-3 flex-col gap-0.5 rounded-xl border-none" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered', 'paid_upi', 'upi')}>
                        <span className="text-xs font-medium opacity-90">Payment: UPI</span>
                        <span className="text-sm font-black">Delivered</span>
                      </Button>
                    </div>
                    <Button variant="secondary" className="w-full rounded-xl h-12 font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border-none" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered', 'delivered_unpaid')}>
                      Mark Delivered Only (Unpaid)
                    </Button>
                  </div>
                )}

                {selectedOrder.status === 'delivered' && isUnpaidStatus(selectedOrder.payment_status) && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Confirm Payment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="primary" className="bg-emerald-500 h-12 rounded-xl font-bold border-none gap-2" onClick={() => confirmPayment(selectedOrder.order_id, 'paid_cash')}>
                        <Banknote size={16} /> Cash Received
                      </Button>
                      <Button variant="accent" className="bg-purple-500 hover:bg-purple-600 h-12 rounded-xl font-bold border-none gap-2" onClick={() => confirmPayment(selectedOrder.order_id, 'paid_upi')}>
                        <CreditCard size={16} /> UPI Received
                      </Button>
                    </div>
                  </div>
                )}

                {selectedOrder.status === 'delivered' && [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PAID_CASH, PAYMENT_STATUS.PAID_UPI].includes(selectedOrder.payment_status) && (
                  <div className="text-center py-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full text-emerald-600 font-bold text-sm">
                      <CheckCircle size={16} /> Order Completed
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[85vh] p-0 border-none shadow-2xl rounded-[32px] bg-white flex flex-col">
          <DialogHeader className="px-8 pt-8 pb-4 bg-white border-b border-slate-50 flex-shrink-0">
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-500">
                <Package size={20} />
              </div>
              New Order
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium ml-1">
              Create a manual delivery order
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Customer Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone</label>
                <input
                  type="tel"
                  placeholder="98765 43210"
                  value={newOrder.customer_phone}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_phone: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-300 placeholder:font-medium"
                />
              </div>

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Name</label>
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={newOrder.customer_name}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-300 placeholder:font-medium"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Delivery Address</label>
              <textarea
                placeholder="Full street address..."
                value={newOrder.customer_address}
                onChange={(e) => setNewOrder({ ...newOrder, customer_address: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-300 placeholder:font-medium resize-none"
              />
            </div>

            {/* Order Details Card */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col gap-5">

              {/* Size Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Can Size</label>
                <div className="grid grid-cols-2 gap-3">
                  {[20, 25].map(size => (
                    <button
                      key={size}
                      onClick={() => setNewOrder({ ...newOrder, litre_size: size })}
                      className={`relative py-3 rounded-xl border-2 transition-all duration-200 ${newOrder.litre_size === size
                        ? 'bg-white border-sky-500 shadow-sm'
                        : 'bg-white border-transparent hover:border-slate-200'
                        }`}
                    >
                      <span className={`text-xl font-black ${newOrder.litre_size === size ? 'text-sky-600' : 'text-slate-400'}`}>{size}L</span>
                      {newOrder.litre_size === size && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-500"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quantity</label>
                <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-1.5">
                  <button
                    onClick={() => setNewOrder({ ...newOrder, quantity: Math.max(1, newOrder.quantity - 1) })}
                    className="w-10 h-10 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors active:scale-95"
                  >
                    <Minus size={18} strokeWidth={3} />
                  </button>
                  <span className="text-2xl font-black text-slate-900 w-12 text-center">{newOrder.quantity}</span>
                  <button
                    onClick={() => setNewOrder({ ...newOrder, quantity: Math.min(20, newOrder.quantity + 1) })}
                    className="w-10 h-10 rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center transition-colors active:scale-95 shadow-sm"
                  >
                    <Plus size={18} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-8 pb-8 pt-4 border-t border-slate-50 sm:justify-between gap-4 flex-shrink-0 bg-white">
            <Button
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(false)}
              className="px-6 h-12 rounded-xl text-slate-500 font-bold hover:bg-slate-50"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={createManualOrder}
              disabled={isCreating}
              className="flex-1 h-12 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all text-base"
              isLoading={isCreating}
            >
              {isCreating ? 'Creating...' : 'Confirm Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reassign Agent Dialog */}
      <Dialog open={isReassignModalOpen} onOpenChange={setIsReassignModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[400px] p-0 border-none shadow-2xl rounded-[32px] bg-white">
          <DialogHeader className="px-8 pt-8 pb-4">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-500">
                <Users size={20} />
              </div>
              Reassign Agent
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium ml-1">
              Select a new agent for this order
            </DialogDescription>
          </DialogHeader>

          <div className="px-8 py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Select Delivery Agent</label>
              <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {deliveryAgents.map(agent => (
                  <button
                    key={agent.staff_id}
                    onClick={() => setNewAgentId(agent.staff_id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${newAgentId === agent.staff_id
                      ? 'bg-sky-50 border-sky-500 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${newAgentId === agent.staff_id ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {agent.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className={`font-bold text-sm ${newAgentId === agent.staff_id ? 'text-sky-900' : 'text-slate-700'}`}>{agent.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Orders: {agent.active_orders_count || 0}</div>
                      </div>
                    </div>
                    {newAgentId === agent.staff_id && <CheckCircle size={16} className="text-sky-500" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 border-t border-slate-50 flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsReassignModalOpen(false)}
              className="flex-1 h-12 rounded-xl text-slate-500 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={reassignOrder}
              disabled={reassigning || !newAgentId}
              className="flex-[2] h-12 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20"
              isLoading={reassigning}
            >
              {reassigning ? 'Reassigning...' : 'Confirm Reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
