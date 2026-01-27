import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20",
  secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
  accent: "bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-lg hover:shadow-sky-500/25 border-none",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-4 text-base",
  icon: "p-2.5",
};

const Button = ({
  variant = 'primary',
  size = 'md',
  className = "",
  isLoading = false,
  icon: Icon,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-300 active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin" size={size === 'lg' ? 20 : 16} />}
      {!isLoading && Icon && <Icon size={size === 'lg' ? 20 : 18} />}
      {children}
    </button>
  );
};

export default Button;
