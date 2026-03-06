import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import '@/App.css';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts (always loaded - needed for shell)
import Layout from './components/layout/Layout';
import AgentLayout from './components/layout/AgentLayout';
import { CompanyNameProvider } from './context/AppContext';
import PrivateRoute from './components/PrivateRoute';
import { PushNotificationService } from './utils/PushNotificationService';

// Lazy-loaded pages (code-split per route for smaller initial bundle)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const Customers = lazy(() => import('./pages/Customers'));
const Stock = lazy(() => import('./pages/Stock'));
const WhatsAppConnect = lazy(() => import('./pages/WhatsAppConnect'));
const Settings = lazy(() => import('./pages/Settings'));
const DeliveryManagement = lazy(() => import('./pages/DeliveryManagement'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPin = lazy(() => import('./pages/ForgotPin'));
const Devices = lazy(() => import('./pages/Settings/Devices'));
const AgentDashboard = lazy(() => import('./pages/agent/AgentDashboard'));
const AgentOrders = lazy(() => import('./pages/agent/AgentOrders'));
const AgentCompleteOrder = lazy(() => import('./pages/agent/AgentCompleteOrder'));
const AgentReportDamage = lazy(() => import('./pages/agent/AgentReportDamage'));
const AgentHistory = lazy(() => import('./pages/agent/AgentHistory'));
const AgentDues = lazy(() => import('./pages/agent/AgentDues'));
const AgentProfile = lazy(() => import('./pages/agent/AgentProfile'));

// Loading spinner shown while lazy chunks load
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0f172a',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid rgba(16, 185, 129, 0.2)',
        borderTopColor: '#10b981',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Capacitor initialization component — must be inside BrowserRouter for useNavigate
function CapacitorInit() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Hide splash screen after app renders
    SplashScreen.hide();

    // Style the status bar for dark theme
    StatusBar.setStyle({ style: Style.Dark }).catch(() => { });
    StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => { });

    // Handle Android hardware back button
    const backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
      } else {
        CapApp.exitApp();
      }
    });

    // Initialize Push Notifications
    PushNotificationService.init();

    // Deep link from notifications
    const handleNotificationOpen = (e) => {
      const { order_id, type } = e.detail;
      if (order_id) {
        // Simple navigation to orders with search term
        navigate(`/orders?search=${order_id}`);
      }
    };

    window.addEventListener('app:notification_opened', handleNotificationOpen);

    return () => {
      backHandler.then(h => h.remove());
      window.removeEventListener('app:notification_opened', handleNotificationOpen);
    };
  }, [navigate]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <CapacitorInit />
          <CompanyNameProvider>
            <Suspense fallback={<PageLoader />}>
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
                <Route path="/agent/dues" element={
                  <PrivateRoute allowedRoles={['delivery_agent']}>
                    <AgentLayout>
                      <AgentDues />
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
                <Route path="/agent/profile" element={
                  <PrivateRoute allowedRoles={['delivery_agent']}>
                    <AgentLayout>
                      <AgentProfile />
                    </AgentLayout>
                  </PrivateRoute>
                } />
              </Routes>
            </Suspense>
          </CompanyNameProvider>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}

export default App;

