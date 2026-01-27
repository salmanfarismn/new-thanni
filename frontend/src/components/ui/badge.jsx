import React from 'react';

const variants = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border border-amber-100",
    error: "bg-red-50 text-red-700 border border-red-100",
    info: "bg-sky-50 text-sky-700 border border-sky-100",
    premium: "bg-slate-900 text-white shadow-lg shadow-slate-900/20",
};

const Badge = ({ children, variant = "default", className = "" }) => {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

export default Badge;
