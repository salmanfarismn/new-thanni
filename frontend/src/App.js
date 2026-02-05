import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@/App.css';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Stock from './pages/Stock';
import WhatsAppConnect from './pages/WhatsAppConnect';
import Settings from './pages/Settings';
import DeliveryManagement from './pages/DeliveryManagement';
import Layout from './components/layout/Layout';
import { CompanyNameProvider } from './context/AppContext';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPin from './pages/ForgotPin';
import PrivateRoute from './components/PrivateRoute';
import Devices from './pages/Settings/Devices';

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

            {/* Protected routes - with layout */}
            <Route path="/" element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/orders" element={
              <PrivateRoute>
                <Layout>
                  <Orders />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/stock" element={
              <PrivateRoute>
                <Layout>
                  <Stock />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/settings" element={
              <PrivateRoute>
                <Layout>
                  <Settings />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/settings/devices" element={
              <PrivateRoute>
                <Layout>
                  <Devices />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/delivery" element={
              <PrivateRoute>
                <Layout>
                  <DeliveryManagement />
                </Layout>
              </PrivateRoute>
            } />
            <Route path="/whatsapp" element={
              <PrivateRoute>
                <Layout>
                  <WhatsAppConnect />
                </Layout>
              </PrivateRoute>
            } />
          </Routes>
        </CompanyNameProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
