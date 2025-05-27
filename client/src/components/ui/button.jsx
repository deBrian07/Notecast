import React from 'react';

export function Button({ children, variant = 'default', size = 'default', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    default: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm',
    outline: 'border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700 bg-white',
    ghost: 'hover:bg-blue-50 text-blue-600 hover:text-blue-700',
    secondary: 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-200'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    default: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  const classes = `${base} ${variants[variant] || variants.default} ${sizes[size]} ${className}`;
  
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
