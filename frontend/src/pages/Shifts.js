import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Clock, Users, Sun, Moon, Calendar, Save, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../components/ui/button';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';

export default function Shifts({ minimal = false }) {
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [staffRes, shiftsRes] = await Promise.all([
        api.get('/delivery-staff'),
        api.get(`/delivery-shifts?date_param=${selectedDate}`)
      ]);

      setStaff(staffRes.data);
      setShifts(shiftsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load shift data');
    } finally {
      setLoading(false);
    }
  };

  const getStaffShift = (staffId) => {
    const shift = shifts.find(s => s.staff_id === staffId && s.date === selectedDate);
    return shift || { shift: 'none', is_active: false };
  };

  const updateStaffShift = (staffId, staffName, shiftType) => {
    const existing = shifts.find(s => s.staff_id === staffId);

    if (existing) {
      setShifts(shifts.map(s =>
        s.staff_id === staffId
          ? { ...s, shift: shiftType, is_active: shiftType !== 'none' }
          : s
      ));
    } else {
      setShifts([...shifts, {
        date: selectedDate,
        staff_id: staffId,
        staff_name: staffName,
        shift: shiftType,
        is_active: shiftType !== 'none'
      }]);
    }
  };

  const saveShifts = async () => {
    try {
      setSaving(true);
      const activeShifts = shifts.filter(s => s.is_active);
      const removalPromises = shifts
        .filter(s => !s.is_active && s._id) // If it has an ID, it needs to be updated/removed on backend
        .map(s => api.post('/delivery-shifts', { ...s, shift: 'none' }));

      // We just post everything based on logic, backend usually handles upsert
      // But adhering to the previous logic:
      for (const shift of shifts) {
        // Post all changes including 'none' to ensure backend updates correctly
        // Or strictly follow previous logic: only if shift !== 'none'
        // The previous code only posted active shifts. Let's stick to that but ensure we handle updates.
        // Actually, if a user changes 'morning' to 'none', we need to send that.
        await api.post('/delivery-shifts', shift);
      }

      toast.success('Shifts saved successfully!');
      loadData();
    } catch (error) {
      console.error('Error saving shifts:', error);
      toast.error('Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };

  const traverseDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const activeStaffCount = shifts.filter(s => s.is_active && s.date === selectedDate).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mb-4"></div>
        <p className="text-slate-500 font-medium">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-24 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        {!minimal && (
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Shift Operations</h1>
            <p className="text-slate-500 font-medium mt-1">Manage delivery schedules and staff availability</p>
          </div>
        )}

        {/* Date Navigator */}
        <div className={`flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1 ${minimal ? 'ml-auto' : ''}`}>
          <button onClick={() => traverseDate(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
            <ChevronLeft size={20} />
          </button>

          <div className="px-4 py-1 text-center min-w-[140px]">
            <span className="text-sm font-semibold text-slate-900 block">
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            {selectedDate === today && (
              <span className="text-xs font-bold text-sky-500 uppercase tracking-wider">Today</span>
            )}
          </div>

          <button onClick={() => traverseDate(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Schedule Area */}
        <div className="lg:col-span-3 space-y-6">

          {/* Active Staff Summary */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                <Users className="text-sky-300" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Active Staff</h2>
                <p className="text-slate-300 text-sm">Scheduled for {new Date(selectedDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-white">{activeStaffCount}</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">On Duty</div>
            </div>
          </div>

          <div className="space-y-4">
            {staff.length > 0 ? (
              staff.map((person) => {
                const currentShift = getStaffShift(person.staff_id);
                const shiftType = currentShift.shift;

                return (
                  <Card key={person.staff_id} noPadding className="overflow-hidden group hover:border-sky-200 transition-all duration-300">
                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">

                        {/* Person Info */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm transition-colors ${shiftType !== 'none'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-slate-100 text-slate-400'
                            }`}>
                            {person.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-slate-900">{person.name}</h3>
                            <p className="text-slate-500 text-sm font-medium">{person.phone_number}</p>
                          </div>
                        </div>

                        {/* Visual Shift Indicator */}
                        {shiftType !== 'none' && (
                          <Badge variant={
                            shiftType === 'morning' ? 'warning' :
                              shiftType === 'evening' ? 'info' : 'success'
                          } className="capitalize px-3 py-1">
                            <CheckCircle2 size={12} className="mr-1.5" />
                            {shiftType.replace('_', ' ')} Assigned
                          </Badge>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="mt-6 pt-6 border-t border-slate-100">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <button
                            onClick={() => updateStaffShift(person.staff_id, person.name, 'morning')}
                            className={`relative p-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-2 ${shiftType === 'morning'
                              ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-amber-200 hover:bg-amber-50/50'
                              }`}
                          >
                            <Sun size={20} className={shiftType === 'morning' ? 'fill-amber-500 text-amber-500' : 'text-slate-400'} />
                            <span>Morning</span>
                            {shiftType === 'morning' && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full border-2 border-white"></div>}
                          </button>

                          <button
                            onClick={() => updateStaffShift(person.staff_id, person.name, 'evening')}
                            className={`relative p-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-2 ${shiftType === 'evening'
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50'
                              }`}
                          >
                            <Moon size={20} className={shiftType === 'evening' ? 'fill-indigo-500 text-indigo-500' : 'text-slate-400'} />
                            <span>Evening</span>
                            {shiftType === 'evening' && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white"></div>}
                          </button>

                          <button
                            onClick={() => updateStaffShift(person.staff_id, person.name, 'full_day')}
                            className={`relative p-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-2 ${shiftType === 'full_day'
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                              }`}
                          >
                            <Clock size={20} className={shiftType === 'full_day' ? 'text-emerald-500' : 'text-slate-400'} />
                            <span>Full Day</span>
                            {shiftType === 'full_day' && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>}
                          </button>

                          <button
                            onClick={() => updateStaffShift(person.staff_id, person.name, 'none')}
                            className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-2 ${shiftType === 'none'
                              ? 'bg-slate-100 border-slate-300 text-slate-500'
                              : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                              }`}
                          >
                            <span className="text-xl leading-none">✕</span>
                            <span>Off</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Users size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-slate-900 font-bold text-lg">No Staff Found</h3>
                <p className="text-slate-500">Add delivery staff to manage shifts</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="bg-sky-50 border-sky-100 shadow-sm">
            <div className="space-y-4">
              <h3 className="font-bold text-sky-900 flex items-center gap-2">
                <AlertCircle size={18} />
                Shift Rules
              </h3>
              <div className="space-y-3">
                <div className="bg-white/60 p-3 rounded-lg text-sm text-sky-900 border border-sky-100">
                  <div className="font-bold text-xs uppercase text-sky-500 mb-1">Morning</div>
                  06:00 AM - 02:00 PM
                </div>
                <div className="bg-white/60 p-3 rounded-lg text-sm text-sky-900 border border-sky-100">
                  <div className="font-bold text-xs uppercase text-sky-500 mb-1">Evening</div>
                  02:00 PM - 10:00 PM
                </div>
                <p className="text-xs text-sky-700 leading-relaxed px-1">
                  Orders are auto-assigned to active staff in the current time slot. If no one is assigned, orders will remain pending.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Floating Save Action Bar */}
      {staff.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-50 px-4">
          <div className="bg-white border border-slate-200 shadow-2xl shadow-slate-300/50 p-2 rounded-2xl pointer-events-auto flex items-center gap-4 animate-slide-up">
            <div className="px-4 text-sm font-medium text-slate-600 hidden sm:block">
              Remember to save your changes
            </div>
            <Button
              size="lg"
              onClick={saveShifts}
              className="shadow-sky-500/20 px-8"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Save Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
