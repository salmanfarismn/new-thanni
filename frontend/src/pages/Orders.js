import { useState, useEffect } from 'react';
import { api } from '../App';
import { Package, TruckIcon, Filter, Search, CheckCircle, XCircle, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    loadOrders();
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
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone.includes(searchTerm);
    return matchesSearch;
  });

  const FilterButton = ({ value, label, count }) => (
    <button
      onClick={() => setFilter(value)}
      data-testid={`filter-${value}`}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        filter === value
          ? 'bg-sky-500 text-white shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:border-sky-200'
      }`}
    >
      {label} {count !== undefined && `(${count})`}
    </button>
  );

  const OrderModal = ({ order, onClose }) => {
    if (!order) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose} data-testid="order-modal">
        <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{order.customer_name}</h2>
                <p className="text-slate-600 text-sm">{order.order_id}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600" data-testid="close-modal-btn">
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-sm text-slate-600 mb-1">Customer Details</div>
                <div className="font-medium text-slate-900">{order.customer_phone}</div>
                <div className="text-slate-700 mt-1">{order.customer_address}</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-sm text-slate-600 mb-1">Order Details</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-slate-700">Quantity</span>
                  <span className="font-semibold">{order.quantity} cans</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-700">Amount</span>
                  <span className="font-semibold text-lg">₹{order.amount}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-sm text-slate-600 mb-1">Delivery Staff</div>
                <div className="font-medium text-slate-900">{order.delivery_staff_name}</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-sm text-slate-600 mb-2">Status</div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                    order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {order.status.toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {order.payment_status === 'paid' ? 'PAID' : 'PAYMENT PENDING'}
                  </span>
                </div>
              </div>

              {order.status === 'pending' && (
                <div className="space-y-2 pt-4">
                  <button
                    onClick={() => updateOrderStatus(order.order_id, 'delivered', 'paid', 'cash')}
                    data-testid="mark-delivered-paid-btn"
                    className="w-full bg-emerald-500 text-white py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    Mark Delivered & Paid (Cash)
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.order_id, 'delivered', 'paid', 'upi')}
                    data-testid="mark-delivered-paid-upi-btn"
                    className="w-full bg-sky-500 text-white py-3 rounded-xl font-semibold hover:bg-sky-600 transition-colors"
                  >
                    Mark Delivered & Paid (UPI)
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.order_id, 'delivered')}
                    data-testid="mark-delivered-btn"
                    className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 transition-colors"
                  >
                    Mark Delivered (Payment Pending)
                  </button>
                </div>
              )}

              {order.status === 'delivered' && order.payment_status === 'pending' && (
                <div className="space-y-2 pt-4">
                  <button
                    onClick={() => updateOrderStatus(order.order_id, 'delivered', 'paid', 'cash')}
                    data-testid="mark-paid-cash-btn"
                    className="w-full bg-emerald-500 text-white py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    Mark Paid (Cash)
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.order_id, 'delivered', 'paid', 'upi')}
                    data-testid="mark-paid-upi-btn"
                    className="w-full bg-sky-500 text-white py-3 rounded-xl font-semibold hover:bg-sky-600 transition-colors"
                  >
                    Mark Paid (UPI)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Orders</h1>
        <p className="text-slate-600 mt-1">Manage all orders</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, phone, or order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-orders-input"
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <FilterButton value="all" label="All" count={orders.length} />
          <FilterButton value="pending" label="Pending" count={orders.filter(o => o.status === 'pending').length} />
          <FilterButton value="delivered" label="Delivered" count={orders.filter(o => o.status === 'delivered').length} />
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <div
              key={order.order_id}
              onClick={() => setSelectedOrder(order)}
              data-testid={`order-item-${order.order_id}`}
              className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-sky-200 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-900">{order.customer_name}</div>
                  <div className="text-sm text-slate-500">{order.order_id}</div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  order.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                  'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                <div className="flex items-center gap-1">
                  <Package size={14} />
                  <span>{order.quantity} cans</span>
                </div>
                <div className="flex items-center gap-1">
                  <IndianRupee size={14} />
                  <span>₹{order.amount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TruckIcon size={14} />
                  <span>{order.delivery_staff_name}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className={`text-xs font-medium ${
                  order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {order.payment_status === 'paid' ? '✓ Paid' : '○ Pending Payment'}
                  {order.payment_method && ` (${order.payment_method.toUpperCase()})`}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(order.created_at).toLocaleString('en-IN', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200" data-testid="no-orders-found">
            <Package className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders found</h3>
            <p className="text-slate-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}
