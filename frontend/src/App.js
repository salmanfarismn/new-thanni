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

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <CompanyNameProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/delivery" element={<DeliveryManagement />} />
              <Route path="/whatsapp" element={<WhatsAppConnect />} />
            </Routes>
          </Layout>
        </CompanyNameProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
