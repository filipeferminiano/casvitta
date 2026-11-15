import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { PhotoPlaceholder } from './PhotoPlaceholder.tsx';

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  highlighted?: boolean;
  href?: string;
};

export type MapPinsProps = {
  /** Accessible name, e.g. "Mapa · Vila Mariana". */
  label: string;
  pins: MapPin[];
  caption?: ReactNode;
  renderLink?: (href: string, className: string, children: ReactNode) => ReactNode;
  onHover?: (id: string | null) => void;
  className?: string;
};

/**
 * Map placeholder with price pins (mockup 53). Positions are projected from lat/lng onto the
 * pins' bounding box; a real map provider replaces the background later.
 */
export function MapPins({ label, pins, caption, renderLink, onHover, className }: MapPinsProps) {
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  const pos = (value: number, min: number, max: number) =>
    max === min ? 50 : 12 + ((value - min) / (max - min)) * 76;
  return (
    <figure
      aria-label={label}
      className={cn('relative overflow-hidden rounded-card border border-line', className)}
    >
      <PhotoPlaceholder className="absolute inset-0" />
      <ul>
        {pins.map((pin) => {
          const pinClass = cn(
            'block rounded-pill border px-2.5 py-1 font-mono text-[13px] font-semibold whitespace-nowrap shadow-menu',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            pin.highlighted
              ? 'border-fg bg-fg text-white'
              : 'border-fg bg-panel text-fg hover:bg-subtle',
          );
          const style = {
            left: `${pos(pin.lng, minLng, maxLng)}%`,
            top: `${100 - pos(pin.lat, minLat, maxLat)}%`,
          };
          return (
            <li
              key={pin.id}
              style={style}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2',
                pin.highlighted && 'z-10',
              )}
              onMouseEnter={() => onHover?.(pin.id)}
              onMouseLeave={() => onHover?.(null)}
              onFocus={() => onHover?.(pin.id)}
              onBlur={() => onHover?.(null)}
            >
              {pin.href && renderLink ? (
                renderLink(pin.href, pinClass, pin.label)
              ) : (
                <span className={pinClass}>{pin.label}</span>
              )}
            </li>
          );
        })}
      </ul>
      {caption ? (
        <figcaption className="absolute bottom-3 left-3 rounded-chip bg-panel px-2 py-1 type-caption">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
