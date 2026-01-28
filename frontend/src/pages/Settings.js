import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Save, Droplet, Droplets, IndianRupee, Clock, ArrowRight, MessageSquare, Users, Building2, RotateCcw, Wallet, Zap, CheckCircle2, Plus, Minus, Layout, Store, Type } from 'lucide-react';
import { toast } from 'sonner';
import { useCompanyName } from '../context/AppContext';

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

  // Company name settings
  const { companyName, refreshCompanyName } = useCompanyName();
  const [editCompanyName, setEditCompanyName] = useState('');
  const [savingCompanyName, setSavingCompanyName] = useState(false);

  useEffect(() => {
    setEditCompanyName(companyName || '');
  }, [companyName]);

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
      await api.put(`/app-settings/company-name?company_name=${encodeURIComponent(trimmed)}`);
      await refreshCompanyName();
      toast.success('Company name saved!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save company name');
    } finally {
      setSavingCompanyName(false);
    }
  };

  const resetCompanyName = async () => {
    try {
      await api.delete('/app-settings/company-name');
      await refreshCompanyName();
      setEditCompanyName('Thanni Canuuu');
      toast.success('Company name reset to default');
    } catch (error) {
      toast.error('Failed to reset company name');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="settings-page">
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
          </TabsList>
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          {/* General Settings */}
          <TabsContent value="general" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Edit Section */}
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Brand Identity</h3>
                    <p className="text-slate-500 text-sm">Manage how your business appears to customers</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Type size={16} className="text-slate-400" />
                      Company Name
                    </label>
                    <div className="relative">
                      <Input
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        maxLength={50}
                        className="h-12 text-lg pl-4 pr-20 font-medium border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all"
                        placeholder="e.g. Thanni Canuuu"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">
                        {editCompanyName.length}/50
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      This name will be displayed on the sidebar, invoices, and messaging signatures.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <Button onClick={saveCompanyName} disabled={savingCompanyName} className="bg-sky-500 hover:bg-sky-600 h-11 px-6 shadow-lg shadow-sky-500/20">
                      {savingCompanyName ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button variant="ghost" onClick={resetCompanyName} className="text-slate-500 h-11">
                      <RotateCcw size={16} className="mr-2" /> Reset Default
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Preview Section */}
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden min-h-[200px] flex flex-col justify-center">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                  <div className="relative z-10">
                    <div className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Layout size={14} /> Sidebar Preview
                    </div>

                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 backdrop-blur-sm max-w-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20 flex-shrink-0">
                          <Droplets className="text-white" size={20} fill="currentColor" />
                        </div>
                        <div className="overflow-hidden">
                          <h1 className="text-lg font-bold tracking-tight text-white truncate">
                            {editCompanyName || 'Company Name'}
                          </h1>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[10px] text-slate-400 font-medium tracking-wide">OPERATIONAL</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-slate-500 text-xs mt-4 text-center">
                      Preview of how your brand appears in the navigation sidebar
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Pricing Settings */}
          <TabsContent value="pricing" className="mt-0 space-y-6">
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-indigo-700 max-w-4xl mx-auto">
              <div className="p-2 bg-indigo-100 rounded-lg h-fit">
                <SettingsIcon size={18} />
              </div>
              <div className="text-sm leading-relaxed font-medium">
                Updating prices affects future orders only. Historical data remains unchanged.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {prices.map((price) => (
                <div
                  key={price.litre_size}
                  className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${price.is_active
                    ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200'
                    : 'bg-slate-50 border-slate-100 opacity-80'
                    }`}
                >
                  <div className="p-6 flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${price.is_active
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-slate-200 text-slate-400'
                          }`}>
                          {price.litre_size}L
                        </div>
                        <div>
                          <h3 className={`font-black text-xl ${price.is_active ? 'text-slate-900' : 'text-slate-400'}`}>Standard Can</h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{price.is_active ? 'Active Product' : 'Archived'}</p>
                        </div>
                      </div>
                      <Switch
                        checked={price.is_active}
                        onCheckedChange={() => toggleActive(price.litre_size)}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>

                    {/* Price Control */}
                    <div className={`p-4 rounded-2xl border ${price.is_active ? 'bg-slate-50 border-slate-100/50' : 'bg-slate-100/50 border-transparent'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <button
                          onClick={() => updatePrice(price.litre_size, (price.price_per_can || 0) - 5)}
                          disabled={!price.is_active || price.price_per_can <= 0}
                          className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-900 disabled:opacity-50 disabled:shadow-none flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                        >
                          <Minus size={20} strokeWidth={2.5} />
                        </button>

                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xl font-bold text-slate-400">₹</span>
                            <span className={`text-4xl font-black tracking-tight ${price.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                              {price.price_per_can}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => updatePrice(price.litre_size, (price.price_per_can || 0) + 5)}
                          disabled={!price.is_active}
                          className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-900 disabled:opacity-50 disabled:shadow-none flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                        >
                          <Plus size={20} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-6 pb-12 sm:pb-0">
              <Button onClick={savePrices} disabled={saving} className="bg-slate-900 hover:bg-slate-800 h-14 px-8 w-full sm:w-auto text-lg rounded-2xl shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
                {saving ? (
                  <RefreshCw className="animate-spin mr-2" />
                ) : (
                  <Save className="mr-2" size={20} />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </TabsContent>

          {/* Workflows */}
          <TabsContent value="workflows" className="mt-0 space-y-6">
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-emerald-800 max-w-4xl mx-auto mb-6">
              <div className="p-2 bg-emerald-100/50 rounded-lg h-fit">
                <Zap size={18} />
              </div>
              <div className="text-sm leading-relaxed font-medium">
                Supercharge your delivery pipeline with automated integrations.
              </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-4">
              <Link to="/whatsapp" className="group block relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-1 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 active:scale-[0.98]">
                <div className="p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Icon */}
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white flex-shrink-0 group-hover:scale-110 transition-transform duration-500">
                    <MessageSquare size={32} fill="currentColor" className="opacity-90" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">WhatsApp Bot</h3>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 flex gap-1.5 items-center px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </Badge>
                    </div>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      Automate orders, status updates, and customer support 24/7.
                    </p>
                  </div>

                  {/* Action */}
                  <div className="w-full sm:w-auto mt-2 sm:mt-0 flex items-center justify-between sm:justify-end gap-3 text-sm font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                    <span className="sm:hidden text-emerald-600">Configure</span>
                    <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-50 flex items-center justify-center transition-colors">
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
