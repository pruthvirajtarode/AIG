import React from 'react';
import type { OrderStatus } from '@/lib/database.types';
import { getStatusConfig } from '@/lib/statusEngine';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = getStatusConfig(status as OrderStatus);
  const sizeStyle = size === 'sm' ? { fontSize: '0.7rem', padding: '0.15rem 0.5rem' } : {};

  return (
    <span className={`badge badge-${config.color}`} style={sizeStyle}>
      {config.label}
    </span>
  );
}
