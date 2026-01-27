import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Package, TruckIcon, Filter, Search, CheckCircle, XCircle, IndianRupee, RefreshCw, Bell, Calendar, ChevronDown, MoreHorizontal, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';
import Button from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
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

  const updateOrderStatus = async (orderId, status, paymentStatus = null, paymentMethod = null) => {
    try {
      const payload = { order_id: orderId, status };
      if (paymentStatus) payload.payment_status = paymentStatus;
      if (paymentMethod) payload.payment_method = paymentMethod;

      await api.put(`/orders/${orderId}/status`, payload);
      toast.success(`Order ${status}!`);
      loadOrders();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
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

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone.includes(searchTerm);
    return matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'delivered': return <Badge variant="success"> Delivered </Badge>;
      case 'pending': return <Badge variant="warning"> Pending </Badge>;
      case 'cancelled': return <Badge variant="error"> Cancelled </Badge>;
      default: return <Badge> {status} </Badge>;
    }
  };

  const getPaymentBadge = (status, method) => {
    if (status === 'paid') {
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle size={10} /> Paid {method && `(${method})`}
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="gap-1">
        <Clock size={10} /> Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="orders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Order Management</h1>
          <p className="text-slate-500 font-medium mt-1">Track and manage customer deliveries</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>All Orders</Button>
          <Button variant={filter === 'pending' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('pending')}>Pending</Button>
          <Button variant={filter === 'delivered' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('delivered')}>Delivered</Button>
        </div>
      </div>

      {/* Main Content Card */}
      <Card noPadding className="overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{filteredOrders.length}</span> results found
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[180px]">Order ID / Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div></div>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <TableRow key={order.order_id} className="group cursor-pointer hover:bg-slate-50/80" onClick={() => { setSelectedOrder(order); setIsDialogOpen(true); }}>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 rounded px-2 py-1 w-fit mb-1">
                        {order.order_id}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{order.customer_name}</div>
                      <div className="text-xs text-slate-500">{order.customer_phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="info" className="bg-sky-50 text-sky-700 border-sky-100">
                          {order.quantity} cans
                        </Badge>
                        <span className="text-sm font-semibold text-slate-600">₹{order.amount}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <TruckIcon size={10} /> {order.delivery_staff_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>
                      {getPaymentBadge(order.payment_status, order.payment_method)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 group-hover:text-sky-500 cursor-pointer">
                        <Eye size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-slate-500">
                    No orders found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Order Details Modal (Dialog) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
              Order Details
              {selectedOrder && <Badge variant="premium" className="text-xs font-mono">{selectedOrder.order_id}</Badge>}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Full order information and management
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="p-6 pt-2 space-y-6">
              {/* Customer Info Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer</h4>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg text-slate-900">{selectedOrder.customer_name}</div>
                    <div className="text-sm text-slate-600">{selectedOrder.customer_phone}</div>
                  </div>
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-400">
                    <Users size={20} />
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-500 bg-white p-3 rounded-xl border border-slate-100">
                  {selectedOrder.customer_address}
                </div>
              </div>

              {/* Order Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-xs text-slate-400 mb-1">Total Amount</div>
                  <div className="text-xl font-black text-slate-900">₹{selectedOrder.amount}</div>
                </div>
                <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-xs text-slate-400 mb-1">Quantity</div>
                  <div className="text-xl font-black text-slate-900">{selectedOrder.quantity} <span className="text-sm font-medium text-slate-400">cans</span></div>
                </div>
              </div>

              {/* Notification Status */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Bell size={16} /> Notification
                </span>
                <div className="flex items-center gap-2">
                  {selectedOrder.notification_status === 'failed' && (
                    <Button variant="ghost" size="sm" onClick={() => retryNotification(selectedOrder.order_id)} className="text-sky-500 h-6 px-2">
                      Retry <RefreshCw size={12} className="ml-1" />
                    </Button>
                  )}
                  <Badge className={selectedOrder.notification_status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>
                    {selectedOrder.notification_status || 'queued'}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {selectedOrder.status === 'pending' && (
                  <>
                    <Button variant="primary" className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered', 'paid', 'cash')}>
                      Mark Delivered & Paid (Cash)
                    </Button>
                    <Button variant="accent" className="w-full" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered', 'paid', 'upi')}>
                      Mark Delivered & Paid (UPI)
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered')}>
                      Mark Delivered Only
                    </Button>
                  </>
                )}

                {selectedOrder.status === 'delivered' && selectedOrder.payment_status === 'pending' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="primary" className="w-full bg-emerald-600" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered', 'paid', 'cash')}>
                      Paid (Cash)
                    </Button>
                    <Button variant="accent" className="w-full" onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered', 'paid', 'upi')}>
                      Paid (UPI)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
