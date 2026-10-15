import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClass = size === 'lg' ? 'spinner-lg' : size === 'sm' ? 'spinner-sm' : '';
  return (
    <span
      className={`spinner ${sizeClass} ${className ?? ''}`.trim()}
      role="status"
      aria-label="Loading"
    />
  );
}
