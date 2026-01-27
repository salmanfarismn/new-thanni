import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Clock, Users, Sun, Moon, Calendar, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function Shifts() {
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

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

      for (const shift of shifts) {
        if (shift.shift !== 'none') {
          await api.post('/delivery-shifts', shift);
        }
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

  const ShiftButton = ({ value, label, icon: Icon, color, staffId, staffName, currentShift }) => {
    const isSelected = currentShift === value;

    return (
      <button
        onClick={() => updateStaffShift(staffId, staffName, value)}
        data-testid={`shift-btn-${staffId}-${value}`}
        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${isSelected
          ? `bg-${color}-500 text-white shadow-md`
          : `bg-${color}-50 text-${color}-700 hover:bg-${color}-100 border border-${color}-200`
          }`}
      >
        <div className="flex flex-col items-center gap-1">
          <Icon size={20} />
          <span className="text-sm">{label}</span>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="shifts-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Delivery Shifts</h1>
        <p className="text-slate-600 mt-1">Manage daily delivery boy schedules</p>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Clock className="text-sky-600 flex-shrink-0 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-sky-900 mb-1">Shift Management</h3>
            <p className="text-sm text-sky-800">
              Assign delivery boys to shifts. Orders are automatically assigned to available staff based on time.
            </p>
            <div className="mt-2 text-sm text-sky-700">
              <span className="font-semibold">Morning:</span> 6 AM - 2 PM  |
              <span className="font-semibold ml-3">Evening:</span> 2 PM - 10 PM
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Today's Schedule</h2>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              data-testid="date-selector"
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-400"
            />
          </div>
        </div>

        <div className="space-y-4">
          {staff.length > 0 ? (
            staff.map((person) => {
              const currentShift = getStaffShift(person.staff_id);

              return (
                <div
                  key={person.staff_id}
                  className="border-2 border-slate-200 rounded-xl p-5 hover:border-sky-200 transition-all"
                  data-testid={`staff-card-${person.staff_id}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center">
                      <Users className="text-sky-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 text-lg">{person.name}</div>
                      <div className="text-sm text-slate-600">{person.phone_number}</div>
                    </div>
                    {currentShift.is_active && (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <ShiftButton
                      value="morning"
                      label="Morning"
                      icon={Sun}
                      color="amber"
                      staffId={person.staff_id}
                      staffName={person.name}
                      currentShift={currentShift.shift}
                    />
                    <ShiftButton
                      value="evening"
                      label="Evening"
                      icon={Moon}
                      color="indigo"
                      staffId={person.staff_id}
                      staffName={person.name}
                      currentShift={currentShift.shift}
                    />
                    <ShiftButton
                      value="full_day"
                      label="Full Day"
                      icon={Clock}
                      color="emerald"
                      staffId={person.staff_id}
                      staffName={person.name}
                      currentShift={currentShift.shift}
                    />
                    <button
                      onClick={() => updateStaffShift(person.staff_id, person.name, 'none')}
                      data-testid={`shift-btn-${person.staff_id}-none`}
                      className={`py-3 px-4 rounded-lg font-medium transition-all ${currentShift.shift === 'none' || !currentShift.is_active
                        ? 'bg-slate-500 text-white shadow-md'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">✕</span>
                        <span className="text-sm">Off</span>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Users size={48} className="mx-auto mb-4 text-slate-300" />
              <p>No delivery staff found</p>
            </div>
          )}
        </div>

        {staff.length > 0 && (
          <button
            onClick={saveShifts}
            disabled={saving}
            data-testid="save-shifts-btn"
            className="w-full bg-sky-500 text-white py-4 rounded-xl font-semibold hover:bg-sky-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-6"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={20} />
                Save Shifts
              </>
            )}
          </button>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-semibold text-amber-900 mb-2">Shift Assignment Rules</h3>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Morning orders (6 AM - 2 PM) assigned to Morning or Full Day staff</li>
          <li>• Evening orders (2 PM - 10 PM) assigned to Evening or Full Day staff</li>
          <li>• If no staff available for a shift, orders will pause</li>
          <li>• Shift settings must be updated daily</li>
          <li>• Round-robin assignment among active staff in each shift</li>
        </ul>
      </div>
    </div>
  );
}
