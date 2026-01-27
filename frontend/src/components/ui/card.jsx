import React from 'react';

const Card = ({ children, className = "", noPadding = false, ...props }) => {
  return (
    <div
      className={`bg-white rounded-3xl border border-slate-100 shadow-bento hover:shadow-bento-hover transition-all duration-300 ${noPadding ? '' : 'p-6'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const GlassCard = ({ children, className = "", ...props }) => {
  return (
    <div
      className={`glass rounded-3xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
