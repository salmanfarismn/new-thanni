import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Save, Droplet, IndianRupee, Clock, ArrowRight, MessageSquare, Users, Building2, RotateCcw, Wallet, Zap, CheckCircle2 } from 'lucide-react';
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

      <Tabs defaultValue="general" className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <TabsList className="bg-white flex flex-col items-stretch h-auto p-2 rounded-2xl border border-slate-100 shadow-sm gap-1">
            <TabsTrigger value="general" className="justify-start gap-3 px-4 py-3 h-auto text-base data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700 data-[state=active]:shadow-none rounded-xl transition-all">
              <Building2 size={18} /> General
            </TabsTrigger>
            <TabsTrigger value="pricing" className="justify-start gap-3 px-4 py-3 h-auto text-base data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700 data-[state=active]:shadow-none rounded-xl transition-all">
              <Wallet size={18} /> Pricing
            </TabsTrigger>
            <TabsTrigger value="workflows" className="justify-start gap-3 px-4 py-3 h-auto text-base data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700 data-[state=active]:shadow-none rounded-xl transition-all">
              <Zap size={18} /> Workflows
            </TabsTrigger>
          </TabsList>
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          {/* General Settings */}
          <TabsContent value="general" className="mt-0 space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Company Identity</h3>
                  <p className="text-slate-500 text-sm">Visible on sidebar and invoices</p>
                </div>
              </div>

              <div className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Company Name</label>
                  <Input
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    maxLength={50}
                    className="h-12 text-lg"
                    placeholder="Enter company name"
                  />
                  <p className="text-xs text-slate-400">Max 50 characters. Default: Thanni Canuuu</p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={saveCompanyName} disabled={savingCompanyName} className="bg-sky-500 hover:bg-sky-600">
                    {savingCompanyName ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="ghost" onClick={resetCompanyName} className="text-slate-500">
                    <RotateCcw size={16} className="mr-2" /> Reset
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Pricing Settings */}
          <TabsContent value="pricing" className="mt-0 space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-indigo-700">
              <SettingsIcon className="mt-0.5" size={20} />
              <div className="text-sm">
                Updating prices will only affect <strong>new future orders</strong>. Existing order history will remain unchanged.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prices.map((price) => (
                <Card key={price.litre_size} className="p-6 relative overflow-hidden group hover:border-sky-300 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                      <Droplet size={24} />
                    </div>
                    <Switch
                      checked={price.is_active}
                      onCheckedChange={() => toggleActive(price.litre_size)}
                    />
                  </div>

                  <div className="mb-4">
                    <div className="text-2xl font-black text-slate-900">{price.litre_size}L</div>
                    <div className="text-sm font-medium text-slate-500">Water Can</div>
                  </div>

                  <div className="relative">
                    <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="number"
                      value={price.price_per_can}
                      onChange={(e) => updatePrice(price.litre_size, e.target.value)}
                      disabled={!price.is_active}
                      className="pl-8 text-lg font-bold h-12"
                    />
                  </div>

                  {!price.is_active && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                      <Badge variant="error">Disabled</Badge>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={savePrices} disabled={saving} className="bg-sky-500 hover:bg-sky-600 h-12 px-8 text-lg">
                <Save size={20} className="mr-2" />
                {saving ? 'Saving Changes...' : 'Save Prices'}
              </Button>
            </div>
          </TabsContent>

          {/* Workflows */}
          <TabsContent value="workflows" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* WhatsApp Integration */}
              <Link to="/whatsapp" className="lg:col-span-2 group">
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 text-white shadow-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>

                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
                        <MessageSquare size={32} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-2xl font-bold">WhatsApp Integration</h3>
                          <Badge variant="secondary" className="bg-white/20 text-white border-0">Primary</Badge>
                        </div>
                        <p className="text-emerald-50 max-w-md">Automate order collection and notifications via WhatsApp API.</p>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </div>
              </Link>

              {/* Delivery Shifts */}
              <Link to="/shifts" className="group">
                <Card className="p-6 h-full hover:border-sky-300 transition-all hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <Clock size={24} />
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Delivery Shifts</h4>
                  <p className="text-slate-500 text-sm mb-4">Manage time slots and staff allocation for morning/evening shifts.</p>
                  <div className="flex items-center text-blue-600 font-medium text-sm group-hover:underline">
                    Manage Schedule <ArrowRight size={14} className="ml-1" />
                  </div>
                </Card>
              </Link>

              {/* Delivery Team */}
              <Link to="/delivery-boys" className="group">
                <Card className="p-6 h-full hover:border-violet-300 transition-all hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                      <Users size={24} />
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Delivery Team</h4>
                  <p className="text-slate-500 text-sm mb-4">Add, remove, and manage delivery personnel accounts.</p>
                  <div className="flex items-center text-violet-600 font-medium text-sm group-hover:underline">
                    Manage Team <ArrowRight size={14} className="ml-1" />
                  </div>
                </Card>
              </Link>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
