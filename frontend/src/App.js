import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@/App.css';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Stock from './pages/Stock';
import WhatsAppConnect from './pages/WhatsAppConnect';
import Settings from './pages/Settings';
import DeliveryManagement from './pages/DeliveryManagement';
import Layout from './components/layout/Layout';
import AgentLayout from './components/layout/AgentLayout';
import { CompanyNameProvider } from './context/AppContext';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPin from './pages/ForgotPin';
import PrivateRoute from './components/PrivateRoute';
import Devices from './pages/Settings/Devices';

// Agent pages
import AgentDashboard from './pages/agent/AgentDashboard';
import AgentOrders from './pages/agent/AgentOrders';
import AgentCompleteOrder from './pages/agent/AgentCompleteOrder';
import AgentReportDamage from './pages/agent/AgentReportDamage';
import AgentHistory from './pages/agent/AgentHistory';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <CompanyNameProvider>
          <Routes>
            {/* Public routes - no layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-pin" element={<ForgotPin />} />

            {/* ============================================ */}
            {/* VENDOR ROUTES - with vendor layout */}
            {/* ============================================ */}
            <Route path="/" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/orders" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <Orders />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/customers" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <Customers />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/stock" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <Stock />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/settings" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <Settings />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/settings/devices" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <Devices />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/delivery" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <DeliveryManagement />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/whatsapp" element={
              <PrivateRoute allowedRoles={['vendor']}>
                <Layout>
                  <WhatsAppConnect />
                </Layout>
              </PrivateRoute>
            } />

            {/* ============================================ */}
            {/* AGENT ROUTES - with agent layout */}
            {/* ============================================ */}
            <Route path="/agent/dashboard" element={
              <PrivateRoute allowedRoles={['delivery_agent']}>
                <AgentLayout>
                  <AgentDashboard />
                </AgentLayout>
              </PrivateRoute>
            } />
            <Route path="/agent/orders" element={
              <PrivateRoute allowedRoles={['delivery_agent']}>
                <AgentLayout>
                  <AgentOrders />
                </AgentLayout>
              </PrivateRoute>
            } />
            <Route path="/agent/complete" element={
              <PrivateRoute allowedRoles={['delivery_agent']}>
                <AgentLayout>
                  <AgentCompleteOrder />
                </AgentLayout>
              </PrivateRoute>
            } />
            <Route path="/agent/damage" element={
              <PrivateRoute allowedRoles={['delivery_agent']}>
                <AgentLayout>
                  <AgentReportDamage />
                </AgentLayout>
              </PrivateRoute>
            } />
            <Route path="/agent/history" element={
              <PrivateRoute allowedRoles={['delivery_agent']}>
                <AgentLayout>
                  <AgentHistory />
                </AgentLayout>
              </PrivateRoute>
            } />
          </Routes>
        </CompanyNameProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
