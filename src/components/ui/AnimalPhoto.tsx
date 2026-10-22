import React from 'react';
import { getAnimalImage } from '@/lib/animalImages';

interface AnimalPhotoProps {
  /** Animal type ('cow', 'goat', ...) or a legacy emoji */
  type: string | null | undefined;
  size?: number;
  radius?: number;
  style?: React.CSSProperties;
}

/** Square, rounded realistic animal photo — use instead of emoji icons. */
export function AnimalPhoto({ type, size = 48, radius = 12, style }: AnimalPhotoProps) {
  return (
    <img
      src={getAnimalImage(type)}
      alt={type && /^[a-z]+$/i.test(type) ? type : 'Animal'}
      loading="lazy"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: 'cover',
        objectPosition: 'center 35%',
        flexShrink: 0,
        display: 'block',
        border: '1px solid rgba(212,168,50,0.25)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        background: 'var(--surface-700)',
        ...style,
      }}
    />
  );
}
