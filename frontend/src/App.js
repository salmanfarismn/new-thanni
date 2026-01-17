import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Droplets, Package, TruckIcon, IndianRupee, Users, Calendar, Settings as SettingsIcon, MessageSquare, Clock } from 'lucide-react';
import '@/App.css';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Stock from './pages/Stock';
import WhatsAppConnect from './pages/WhatsAppConnect';
import Settings from './pages/Settings';
import Shifts from './pages/Shifts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

function BottomNav() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Package, label: 'Dashboard' },
    { path: '/orders', icon: TruckIcon, label: 'Orders' },
    { path: '/stock', icon: Droplets, label: 'Stock' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 md:hidden" data-testid="bottom-nav">
      <div className="grid grid-cols-4 gap-1 px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${isActive
                  ? 'bg-sky-50 text-sky-600'
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Package, label: 'Dashboard' },
    { path: '/orders', icon: TruckIcon, label: 'Orders' },
    { path: '/stock', icon: Droplets, label: 'Stock' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed left-0 top-0 bottom-0 z-40" data-testid="sidebar">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center">
            <Droplets className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Thanni Canuuu</h1>
            <p className="text-xs text-slate-500">Water Delivery</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`sidebar-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                  ? 'bg-sky-50 text-sky-600 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="md:ml-64 pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/shifts" element={<Shifts />} />
            <Route path="/whatsapp" element={<WhatsAppConnect />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </div>
  );
}

export default App;
