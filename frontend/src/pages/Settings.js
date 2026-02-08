import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, useCompanyName } from '../context/AppContext';
import {
  Settings as SettingsIcon, Save, Droplets, ArrowRight, MessageSquare, Users,
  Building2, RotateCcw, Wallet, Zap, CheckCircle2, Plus, Minus, Layout, Store,
  Type, Shield, Smartphone, Lock, AlertTriangle, Trash2, Camera, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { removeAuthToken } from '../api/axios';

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
  const fileInputRef = React.useRef(null);
  const navigate = useNavigate();

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
  }, []);

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
      toast.success('Price settings saved successfully!');
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
      toast.success('Business name updated!');
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
      toast.success('Owner name updated!');
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
        toast.success('Company name reset to default');
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
      toast.success('Logo updated successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      if (window.confirm('Are you sure you want to remove the logo?')) {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-500 font-medium mt-1">Manage business configuration</p>
      </div>

      <Tabs defaultValue="general" className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0 lg:sticky lg:top-6 z-10">
          <TabsList className="flex flex-row lg:flex-col overflow-x-auto justify-start items-center lg:items-stretch bg-transparent lg:bg-white p-1 lg:p-2 rounded-xl lg:rounded-2xl border-0 lg:border lg:border-slate-100 lg:shadow-sm gap-2 no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-2 w-[calc(100%+2rem)] lg:w-full h-auto">
            <TabsTrigger value="general" className="flex-shrink-0 gap-2 px-5 py-2.5 h-auto text-sm font-bold bg-white border border-slate-200 lg:border-transparent lg:bg-transparent data-[state=active]:bg-slate-900 data-[state=active]:text-white lg:data-[state=active]:bg-sky-50 lg:data-[state=active]:text-sky-700 data-[state=active]:border-slate-900 data-[state=active]:shadow-lg lg:data-[state=active]:shadow-none rounded-full lg:rounded-xl lg:justify-start lg:px-4 lg:py-3 lg:text-base transition-all">
              <Building2 size={16} className="lg:w-[18px] lg:h-[18px]" /> General
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex-shrink-0 gap-2 px-5 py-2.5 h-auto text-sm font-bold bg-white border border-slate-200 lg:border-transparent lg:bg-transparent data-[state=active]:bg-slate-900 data-[state=active]:text-white lg:data-[state=active]:bg-sky-50 lg:data-[state=active]:text-sky-700 data-[state=active]:border-slate-900 data-[state=active]:shadow-lg lg:data-[state=active]:shadow-none rounded-full lg:rounded-xl lg:justify-start lg:px-4 lg:py-3 lg:text-base transition-all">
              <Wallet size={16} className="lg:w-[18px] lg:h-[18px]" /> Pricing
            </TabsTrigger>
            <TabsTrigger value="workflows" className="flex-shrink-0 gap-2 px-5 py-2.5 h-auto text-sm font-bold bg-white border border-slate-200 lg:border-transparent lg:bg-transparent data-[state=active]:bg-slate-900 data-[state=active]:text-white lg:data-[state=active]:bg-sky-50 lg:data-[state=active]:text-sky-700 data-[state=active]:border-slate-900 data-[state=active]:shadow-lg lg:data-[state=active]:shadow-none rounded-full lg:rounded-xl lg:justify-start lg:px-4 lg:py-3 lg:text-base transition-all">
              <Zap size={16} className="lg:w-[18px] lg:h-[18px]" /> Workflows
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-shrink-0 gap-2 px-5 py-2.5 h-auto text-sm font-bold bg-white border border-slate-200 lg:border-transparent lg:bg-transparent data-[state=active]:bg-slate-900 data-[state=active]:text-white lg:data-[state=active]:bg-sky-50 lg:data-[state=active]:text-sky-700 data-[state=active]:border-slate-900 data-[state=active]:shadow-lg lg:data-[state=active]:shadow-none rounded-full lg:rounded-xl lg:justify-start lg:px-4 lg:py-3 lg:text-base transition-all">
              <Shield size={16} className="lg:w-[18px] lg:h-[18px]" /> Security
            </TabsTrigger>
          </TabsList>
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          {/* General Settings */}
          <TabsContent value="general" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Identity Section */}
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Brand Identity</h3>
                    <p className="text-slate-500 text-sm">Manage business appearing names</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Type size={16} className="text-slate-400" />
                      Business Name
                    </label>
                    <div className="relative">
                      <Input
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        maxLength={50}
                        className="h-12 text-lg pl-4 pr-20 font-medium border-slate-200 focus:border-sky-500 transition-all"
                        placeholder="e.g. Thanni Canuuu"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">
                        {editCompanyName.length}/50
                      </div>
                    </div>
                    <Button onClick={saveCompanyName} disabled={savingCompanyName} className="bg-sky-500 hover:bg-sky-600 h-11 px-6 shadow-lg shadow-sky-500/20">
                      {savingCompanyName ? 'Saving...' : 'Update Business Name'}
                    </Button>
                  </div>

                  <div className="space-y-3 pt-6 border-t border-slate-100">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Users size={16} className="text-slate-400" />
                      Registered Owner Name
                    </label>
                    <div className="relative">
                      <Input
                        value={editOwnerName}
                        onChange={(e) => setEditOwnerName(e.target.value)}
                        maxLength={50}
                        className="h-12 text-lg pl-4 pr-4 font-medium border-slate-200 focus:border-sky-500 transition-all"
                        placeholder="Enter owner name"
                      />
                    </div>
                    <Button onClick={saveOwnerName} disabled={savingProfile} variant="secondary" className="h-10 px-6">
                      {savingProfile ? 'Saving...' : 'Update Owner Name'}
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-slate-50">
                    <Button variant="ghost" onClick={resetCompanyName} className="text-slate-500 h-10 px-0">
                      <RotateCcw size={16} className="mr-2" /> Reset Business Name
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Logo Section */}
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600">
                    <Camera size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Company Logo</h3>
                    <p className="text-slate-500 text-sm">Upload for sidebar and invoices</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-6 py-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-all overflow-hidden"
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <Camera size={24} className="mb-1" />
                        <span className="text-[10px] font-bold">UPLOAD</span>
                      </div>
                    )}
                    {uploadingLogo && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <RefreshCw className="animate-spin text-sky-500" />
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                  {logoUrl && (
                    <button onClick={handleRemoveLogo} className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 mx-auto">
                      <Trash2 size={12} /> Remove Logo
                    </button>
                  )}
                </div>
              </Card>

              {/* Preview */}
              <div className="xl:col-span-2">
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  <div className="relative z-10">
                    <div className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Layout size={14} /> Sidebar Preview
                    </div>
                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 backdrop-blur-sm max-w-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <Droplets className="text-slate-900" size={24} fill="currentColor" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <h1 className="text-lg font-bold tracking-tight text-white truncate">{editCompanyName || 'Business Name'}</h1>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Operational</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Pricing Settings */}
          <TabsContent value="pricing" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {prices.map((price) => (
                <div key={price.litre_size} className={`rounded-3xl border p-6 transition-all ${price.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg">
                        {price.litre_size}L
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-900">Standard Can</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{price.is_active ? 'Active' : 'Inactive'}</p>
                      </div>
                    </div>
                    <Switch checked={price.is_active} onCheckedChange={() => toggleActive(price.litre_size)} />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 flex items-center justify-between">
                    <button onClick={() => updatePrice(price.litre_size, price.price_per_can - 5)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Minus size={18} />
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-xl font-bold text-slate-400">₹</span>
                      <span className="text-3xl font-black text-slate-900">{price.price_per_can}</span>
                    </div>
                    <button onClick={() => updatePrice(price.litre_size, price.price_per_can + 5)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-6">
              <Button onClick={savePrices} disabled={saving} className="bg-slate-900 h-12 px-8 rounded-xl shadow-xl">
                {saving ? <RefreshCw className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                Save Price Changes
              </Button>
            </div>
          </TabsContent>

          {/* Workflows */}
          <TabsContent value="workflows" className="mt-0">
            <div className="max-w-4xl mx-auto">
              <Link to="/whatsapp" className="block bg-white border border-slate-200 rounded-3xl p-8 hover:border-emerald-500 hover:shadow-xl transition-all">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <MessageSquare size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">WhatsApp Bot</h3>
                    <p className="text-slate-500 mt-1">Automate orders and customer support 24/7.</p>
                  </div>
                  <div className="ml-auto w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                    <ArrowRight size={20} />
                  </div>
                </div>
              </Link>
            </div>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="mt-0 space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-500">
                      {companyName.substring(0, 2).toUpperCase()}
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">Verified Account</Badge>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{companyName}</h3>
                  <p className="text-slate-600 font-bold">{vendor?.name}</p>
                  <p className="text-sky-600 font-mono text-sm mt-1">{vendor?.phone}</p>
                  <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500" /> ACTIVE
                  </div>
                </div>
              </Card>

              {/* PIN Change */}
              <Card className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold">Security PIN</h3>
                    <p className="text-slate-500 text-sm">Update your 6-digit access PIN</p>
                  </div>
                  <Lock className="text-slate-300" />
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Current PIN</label>
                    <Input type="password" placeholder="••••••" className="h-12 bg-slate-50 text-center tracking-widest text-lg font-bold" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">New PIN</label>
                    <Input type="password" placeholder="••••••" className="h-12 text-center tracking-widest text-lg font-bold" />
                    <Button className="w-full bg-slate-900 h-12 rounded-xl">Update PIN</Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
