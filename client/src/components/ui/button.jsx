import React from 'react';

export function Button({ children, variant = 'default', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50';
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700'
  };
  const classes = `${base} ${variants[variant] || variants.default}`;
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
