import { useState } from 'react';
import { Users, Clock } from 'lucide-react';
import DeliveryAgents from './DeliveryAgents';
import Shifts from './Shifts';

export default function DeliveryManagement() {
    const [activeTab, setActiveTab] = useState('team');

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-0 pb-12">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Delivery Management</h1>
                <p className="text-slate-500 font-medium mt-1">Unified control center for your delivery operations</p>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-full md:w-fit border border-slate-200">
                <button
                    onClick={() => setActiveTab('team')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === 'team'
                            ? 'bg-white shadow-sm text-sky-600 ring-1 ring-black/5'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <Users size={18} />
                    Delivery Team
                </button>
                <button
                    onClick={() => setActiveTab('shifts')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === 'shifts'
                            ? 'bg-white shadow-sm text-sky-600 ring-1 ring-black/5'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <Clock size={18} />
                    Shift Schedule
                </button>
            </div>

            {/* Content Area */}
            <div className="animate-fade-in min-h-[500px]">
                {activeTab === 'team' ? (
                    <DeliveryAgents minimal={true} />
                ) : (
                    <Shifts minimal={true} />
                )}
            </div>
        </div>
    );
}
