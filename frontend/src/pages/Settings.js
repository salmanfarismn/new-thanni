import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, useCompanyName } from '../context/AppContext';
import {
  Settings as SettingsIcon, Save, Droplets, ArrowRight, MessageSquare, Users,
  Building2, RotateCcw, Wallet, Zap, CheckCircle2, Plus, Minus, Layout, Store,
  Type, Shield, Smartphone, Lock, AlertTriangle, Trash2, Camera, RefreshCw,
  ChevronRight, Menu, X, Bell, Volume2, BellRing, CreditCard, Package
} from 'lucide-react';
import { toast } from 'sonner';

import Card from '../components/ui/card';
import Button from '../components/ui/button';
import Badge from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

export default function Settings() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company and Vendor settings from Context
  const { companyName, refreshCompanyName, logoUrl, setLogoUrl, vendor, setVendor } = useCompanyName();

  const [editCompanyName, setEditCompanyName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [savingCompanyName, setSavingCompanyName] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    order_alerts: true,
    payment_alerts: true,
    system_alerts: true,
    sound_enabled: true,
    push_enabled: true
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(null);

  useEffect(() => {
    setEditCompanyName(companyName || '');
  }, [companyName]);

  useEffect(() => {
    if (vendor) {
      setEditOwnerName(vendor.name || '');
    }
  }, [vendor]);

  useEffect(() => {
    loadPrices();
    loadNotificationPrefs();
  }, []);

  const loadNotificationPrefs = async () => {
    try {
      setNotifLoading(true);
      const res = await api.get('/notifications/preferences');
      setNotifPrefs(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      // Defaults are fine if never set
    } finally {
      setNotifLoading(false);
    }
  };

  const updateNotifPref = async (key, value) => {
    const prev = notifPrefs[key];
    setNotifPrefs(p => ({ ...p, [key]: value }));
    setNotifSaving(key);
    try {
      await api.put('/notifications/preferences', { [key]: value });
      toast.success('Preference updated');
    } catch (err) {
      setNotifPrefs(p => ({ ...p, [key]: prev }));
      toast.error('Failed to update preference');
    } finally {
      setNotifSaving(null);
    }
  };

  const loadPrices = async () => {
    try {
      const response = await api.get('/price-settings');
      const existingPrices = response.data;

      if (existingPrices.length === 0) {
        setPrices([
          { litre_size: 20, price_per_can: 45, is_active: true },
          { litre_size: 25, price_per_can: 55, is_active: true }
        ]);
      } else {
        setPrices(existingPrices);
      }
    } catch (error) {
      console.error('Error loading prices:', error);
      toast.error('Failed to load price settings');
    } finally {
      setLoading(false);
    }
  };

  const updatePrice = (litreSize, newPrice) => {
    setPrices(prices.map(p =>
      p.litre_size === litreSize
        ? { ...p, price_per_can: parseFloat(newPrice) || 0 }
        : p
    ));
  };

  const toggleActive = (litreSize) => {
    setPrices(prices.map(p =>
      p.litre_size === litreSize
        ? { ...p, is_active: !p.is_active }
        : p
    ));
  };

  const savePrices = async () => {
    try {
      setSaving(true);
      for (const price of prices) {
        await api.post('/price-settings', price);
      }
      toast.success('Price settings updated');
      loadPrices();
    } catch (error) {
      console.error('Error saving prices:', error);
      toast.error('Failed to save price settings');
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyName = async () => {
    const trimmed = editCompanyName.trim();
    if (!trimmed) {
      toast.error('Company name cannot be empty');
      return;
    }
    try {
      setSavingCompanyName(true);
      const response = await api.patch('/auth/profile', {
        business_name: trimmed
      });
      setVendor(response.data);
      await refreshCompanyName();
      toast.success('Business name updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save business name');
    } finally {
      setSavingCompanyName(false);
    }
  };

  const saveOwnerName = async () => {
    const trimmed = editOwnerName.trim();
    if (!trimmed) {
      toast.error('Owner name cannot be empty');
      return;
    }
    try {
      setSavingProfile(true);
      const response = await api.patch('/auth/profile', {
        name: trimmed
      });
      setVendor(response.data);
      toast.success('Owner name updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const resetCompanyName = async () => {
    try {
      if (window.confirm('Reset business name to default?')) {
        await api.delete('/app-settings/company-name');
        await refreshCompanyName();
        setEditCompanyName('Thanni Canuuu');
        toast.success('Restored default name');
      }
    } catch (error) {
      toast.error('Failed to reset company name');
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/app-settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      let url = response.data.logo_url;
      if (url && url.startsWith('/static')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
        url = `${backendUrl}${url}`;
      }
      setLogoUrl(url);
      toast.success('Logo uploaded');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      if (window.confirm('Remove current logo?')) {
        await api.delete('/app-settings/logo');
        setLogoUrl(null);
        toast.success('Logo removed');
      }
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32 md:pb-16 max-w-6xl mx-auto animate-fade-in px-4 md:px-8">
      {/* Page Header */}
      <div className="pt-8 md:pt-4 mb-2 md:mb-8 relative z-30">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-1">Settings</h1>
        <p className="text-slate-500 font-medium text-sm md:text-base">Manage your business & app preferences</p>
      </div>

      <Tabs defaultValue="general" className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-10 mt-4 md:mt-8 relative z-10 w-full">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0 lg:sticky lg:top-28 z-40 lg:z-20">
          <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
            {/* Scrollable tabs wrapper */}

            <TabsList className="
              flex flex-row lg:flex-col justify-start overflow-x-auto lg:overflow-visible items-center lg:items-stretch gap-2 
              bg-white/90 lg:bg-transparent p-2 lg:p-0 rounded-2xl lg:rounded-none no-scrollbar w-full h-auto 
              relative z-30 backdrop-blur-xl border border-slate-200/60 lg:border-none
              shadow-lg shadow-slate-200/40 lg:shadow-none
            ">
              {[
                { id: 'general', icon: Store, label: 'General' },
                { id: 'pricing', icon: Wallet, label: 'Pricing' },
                { id: 'workflows', icon: Zap, label: 'Workflows' },
                { id: 'security', icon: Shield, label: 'Security' },
                { id: 'notifications', icon: Bell, label: 'Alerts' }
              ].map(({ id, icon: Icon, label }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="
                    flex-shrink-0 flex items-center gap-2.5 px-5 py-3 lg:py-2.5 rounded-full lg:rounded-xl text-sm font-black border-2 border-transparent
                    data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-slate-900/20 data-[state=active]:scale-105
                    lg:data-[state=active]:scale-100 lg:data-[state=active]:bg-white lg:data-[state=active]:text-slate-900 lg:data-[state=active]:border-slate-200 lg:data-[state=active]:shadow-md
                    text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hover:bg-transparent transition-all duration-300
                  "
                >
                  <Icon size={18} strokeWidth={2.5} className="md:w-4 md:h-4 lg:stroke-[3px]" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* GENERAL SETTINGS */}
          <TabsContent value="general" className="mt-0 space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Identity Card */}
              <Card className="p-5 md:p-8 flex flex-col gap-8 bg-white/80 backdrop-blur-xl shadow-lg shadow-slate-200/40 border-slate-100/60 rounded-[32px] hover:shadow-xl hover:border-indigo-100/50 transition-all duration-500">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner border border-indigo-100/50">
                    <Store size={26} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">Brand Details</h3>
                    <p className="text-slate-500 text-sm font-medium">Business name & owner info</p>
                  </div>
                </div>

                <div className="space-y-7">
                  {/* Business Name */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Business Name</label>
                    <div className="relative group">
                      <Input
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        maxLength={50}
                        className="h-14 text-lg font-bold border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all px-4 md:px-5 bg-slate-50/50 focus:bg-white rounded-2xl"
                        placeholder="e.g. Thanni Canuuu"
                      />
                    </div>
                    <Button
                      onClick={saveCompanyName}
                      disabled={savingCompanyName}
                      className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all"
                    >
                      {savingCompanyName ? 'Saving...' : 'Save Name'}
                    </Button>
                  </div>

                  <div className="h-px bg-slate-100 w-full"></div>

                  {/* Owner Name */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Owner Name</label>
                    <Input
                      value={editOwnerName}
                      onChange={(e) => setEditOwnerName(e.target.value)}
                      maxLength={50}
                      className="h-14 text-base font-bold border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all px-4 md:px-5 rounded-2xl"
                      placeholder="Enter owner name"
                    />
                    <Button
                      onClick={saveOwnerName}
                      disabled={savingProfile}
                      variant="outline"
                      className="w-full h-12 text-sm font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-2xl block border-2"
                    >
                      {savingProfile ? 'Saving...' : 'Update Owner'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Logo & Preview */}
              <div className="space-y-6">
                <Card className="p-5 md:p-8 bg-white/80 backdrop-blur-xl shadow-lg shadow-slate-200/40 border-slate-100/60 rounded-[32px]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-rose-50 to-orange-50 rounded-2xl flex items-center justify-center text-rose-500 shadow-inner border border-rose-100/50">
                        <Camera size={26} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight">Brand Logo</h3>
                        <p className="text-sm text-slate-500 font-medium">For invoices & headers</p>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative w-full aspect-[2/1] md:aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-100 transition-all duration-300 overflow-hidden"
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full object-contain p-2 transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center">
                          <Plus size={24} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider group-hover:text-slate-600 transition-colors">Tap to Upload</span>
                      </div>
                    )}
                    {uploadingLogo && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm z-10">
                        <RefreshCw className="animate-spin text-slate-900" />
                      </div>
                    )}

                    {logoUrl && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                          className="p-2 bg-white/90 text-red-500 rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                </Card>

                {/* Minimal Preview */}
                <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-xl flex items-center gap-4 relative overflow-hidden">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {logoUrl ? <img src={logoUrl} className="w-full h-full object-contain" alt="" /> : <Droplets size={20} className="text-slate-900" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sidebar Preview</div>
                    <div className="font-bold truncate text-base">{editCompanyName || 'Company Name'}</div>
                  </div>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2"></div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PRICING SETTINGS */}
          <TabsContent value="pricing" className="mt-0 space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="flex flex-col gap-6">
              <div className="bg-slate-900 text-white rounded-[32px] p-6 md:p-8 relative overflow-hidden shadow-2xl shadow-slate-900/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-black flex items-center gap-3 mb-2">
                    <Wallet size={24} className="text-emerald-400" />
                    Order Pricing
                  </h3>
                  <p className="text-slate-400 font-medium leading-relaxed max-w-md">
                    Set the price per can for your customers. Toggle functionality to temporarily hide a product from new orders.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prices.map((price) => (
                  <div key={price.litre_size} className={`
                       bg-white border rounded-3xl p-6 transition-all duration-300
                       ${price.is_active ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60 bg-slate-50'}
                    `}>
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex gap-4 items-center">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black transition-all ${price.is_active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-slate-200 text-slate-500 border-2 border-slate-300 border-dashed'}`}>
                          {price.litre_size}L
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-xl leading-none">Standard Can</h3>
                          <span className={`text-xs font-bold uppercase tracking-widest mt-1.5 block ${price.is_active ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {price.is_active ? 'Active Product' : 'Hidden'}
                          </span>
                        </div>
                      </div>
                      <Switch checked={price.is_active} onCheckedChange={() => toggleActive(price.litre_size)} className={`scale-110 ${price.is_active ? 'data-[state=checked]:bg-emerald-500' : ''}`} />
                    </div>

                    <div className="bg-slate-50/50 rounded-[24px] p-2 flex items-center justify-between border border-slate-100">
                      <button
                        onClick={() => updatePrice(price.litre_size, price.price_per_can - 5)}
                        className="w-14 h-14 bg-white rounded-[20px] shadow-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all text-slate-600 disabled:opacity-50"
                        disabled={!price.is_active}
                      >
                        <Minus size={20} strokeWidth={2.5} />
                      </button>
                      <div className="text-center px-4 min-w-[100px]">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Rate</div>
                        <div className="text-2xl font-black text-slate-900 flex items-center justify-center">
                          <span className="text-slate-400 text-lg mr-0.5">₹</span>{price.price_per_can}
                        </div>
                      </div>
                      <button
                        onClick={() => updatePrice(price.litre_size, price.price_per_can + 5)}
                        className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-slate-600 disabled:opacity-50"
                        disabled={!price.is_active}
                      >
                        <Plus size={20} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-4 md:static flex justify-center pt-4 z-30 pointer-events-none md:pointer-events-auto">
              <Button
                onClick={savePrices}
                disabled={saving}
                className="pointer-events-auto bg-slate-900 hover:bg-slate-800 text-white h-14 px-10 rounded-full shadow-xl shadow-slate-900/20 font-bold text-base transition-transform active:scale-95"
              >
                {saving ? <RefreshCw className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                Save Changes
              </Button>
            </div>
          </TabsContent>

          {/* WORKFLOWS */}
          <TabsContent value="workflows" className="mt-0 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="grid gap-6">
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 flex-shrink-0">
                  <MessageSquare size={32} strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900">WhatsApp Integration</h3>
                  <p className="text-slate-600 font-medium mt-1 leading-relaxed">
                    Connect your business WhatsApp number to enable automated ordering, delivery updates, and customer support bots.
                  </p>
                </div>
                <Link to="/whatsapp">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-600/20 px-6 h-12 rounded-xl">
                    Manage Bot <ArrowRight size={16} className="ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </TabsContent>

          {/* SECURITY */}
          <TabsContent value="security" className="mt-0 space-y-4 md:space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            {/* Digital ID */}
            <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 text-center md:text-left">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl md:text-4xl font-black border border-white/10 shadow-inner shrink-0">
                  {companyName.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-3 mb-2">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight truncate max-w-full">{companyName}</h2>
                    <Badge variant="success" className="border-emerald-500/20 font-black">VERIFIED MERCHANT</Badge>
                  </div>
                  <div className="space-y-1 text-slate-400 font-medium text-sm md:text-base">
                    <p className="flex items-center justify-center md:justify-start gap-2">
                      <Users size={16} />
                      {vendor?.name || 'Owner Name'}
                    </p>
                    <p className="flex items-center justify-center md:justify-start gap-2 font-mono opacity-70">
                      <Smartphone size={16} />
                      {vendor?.phone}
                    </p>
                  </div>
                </div>
                <div className="w-full md:w-auto mt-2 md:mt-0 p-3 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm">
                  <div className="flex justify-between md:block items-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest md:mb-1">Session Status</p>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      Active Now
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* PIN Manager */}
              <Card className="p-5 md:p-8 bg-white shadow-sm border-slate-100 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Lock size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">Access PIN</h3>
                    <p className="text-xs text-slate-500 font-medium">Secure your app access</p>
                  </div>
                </div>

                <div className="space-y-5 flex-1 flex flex-col justify-end">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">New 6-Digit PIN</label>
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="••••••"
                        maxLength={6}
                        className="text-center tracking-[0.5em] text-xl font-bold h-14 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
                      />
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                        <RotateCcw size={16} />
                      </div>
                    </div>
                  </div>
                  <Button className="w-full bg-slate-900 hover:bg-slate-800 h-12 rounded-xl font-bold shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all">
                    Update PIN Code
                  </Button>
                </div>
              </Card>

              {/* Danger Zone */}
              <Card className="p-5 md:p-8 bg-red-50/50 border-red-100 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                    <AlertTriangle size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-900 leading-tight">Danger Zone</h3>
                    <p className="text-xs text-red-700/60 font-medium">Irreversible actions</p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-end space-y-4">
                  <div className="bg-white/60 p-4 rounded-xl border border-red-100/50">
                    <p className="text-sm text-red-800 font-medium leading-relaxed">
                      Deactivating your account will immediately stop all order processing and hide your store from customers.
                    </p>
                  </div>
                  <Button variant="outline" className="bg-white border-red-200 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 w-full h-12 rounded-xl font-bold shadow-sm transition-all">
                    Deactivate Account
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications" className="mt-0 space-y-4 md:space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <Card className="p-5 md:p-8 bg-white shadow-sm border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <BellRing size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Notification Preferences</h2>
                  <p className="text-sm text-slate-500 font-medium">Control what alerts you receive</p>
                </div>
              </div>

              <div className="space-y-1">
                {[
                  { key: 'order_alerts', icon: Package, label: 'Order Alerts', desc: 'New orders, deliveries, and cancellations', color: 'text-sky-500', bg: 'bg-sky-50' },
                  { key: 'payment_alerts', icon: CreditCard, label: 'Payment Alerts', desc: 'Payment confirmations and pending dues', color: 'text-emerald-500', bg: 'bg-emerald-50' },
                  { key: 'system_alerts', icon: AlertTriangle, label: 'System Alerts', desc: 'Stock warnings and app updates', color: 'text-amber-500', bg: 'bg-amber-50' },
                  { key: 'sound_enabled', icon: Volume2, label: 'Sound', desc: 'Play notification sounds', color: 'text-violet-500', bg: 'bg-violet-50' },
                  { key: 'push_enabled', icon: Smartphone, label: 'Push Notifications', desc: 'Receive alerts on your device', color: 'text-rose-500', bg: 'bg-rose-50' },
                ].map(({ key, icon: Icon, label, desc, color, bg }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>
                        <Icon size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{label}</p>
                        <p className="text-xs text-slate-400 font-medium">{desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifPrefs[key]}
                      onCheckedChange={(v) => updateNotifPref(key, v)}
                      disabled={notifSaving === key}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
