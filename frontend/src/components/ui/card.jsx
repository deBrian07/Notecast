import React from 'react';

export function Card({ children, className = '' }) {
  return (
    <div
      className={
        `bg-white rounded-lg shadow ${className}`.trim()
      }
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-4 ${className}`.trim()}>
      {children}
    </div>
  );
}
