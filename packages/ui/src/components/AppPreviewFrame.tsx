import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { Avatar } from './Avatar.tsx';
import { BrowserFrame } from './Frames.tsx';
import { Logo } from './Logo.tsx';

export type AppPreviewNavItem = {
  key: string;
  label: ReactNode;
  icon: ReactNode;
  active?: boolean;
};

export type AppPreviewFrameProps = {
  /** What the picture shows, read by screen readers ("Exemplo ilustrativo: lista de imóveis…"). */
  label: string;
  url: string;
  nav: AppPreviewNavItem[];
  /** Screen title in the top bar ("Meus imóveis"). */
  title: ReactNode;
  /** Demo user shown at the top right ("Ana Ribeiro"). */
  userName: string;
  children: ReactNode;
  /** Hide the side nav on narrow previews. */
  compact?: boolean;
  /** Visible line under the frame (e.g. "Demonstrativo" badge + "Exemplo ilustrativo"). */
  note?: ReactNode;
  className?: string;
};

/**
 * Static picture of the product inside a browser frame, for marketing pages. It is an image
 * (role="img"), not live data: everything inside is decorative and read once through `label`.
 */
export function AppPreviewFrame({
  label,
  url,
  nav,
  title,
  userName,
  children,
  compact,
  note,
  className,
}: AppPreviewFrameProps) {
  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div role="img" aria-label={label}>
        <BrowserFrame url={url} className="select-none">
          <div aria-hidden="true" className="flex min-h-0 text-[12px] leading-4">
            {compact ? null : (
              <div className="hidden w-[132px] shrink-0 flex-col gap-1 border-r border-line p-3 sm:flex">
                <Logo height={12} title={null} className="mb-3" />
                {nav.map((item) => (
                  <span
                    key={item.key}
                    className={cn(
                      'flex items-center gap-1.5 rounded-chip px-1.5 py-1 text-fg-strong [&>svg]:size-3.5',
                      item.active && 'bg-action-subtle font-semibold text-action-hover',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </span>
                ))}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">{title}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-fg-muted">
                  <Avatar name={userName} size={32} className="size-6 text-[10px]" />
                  <span className="hidden sm:inline">{userName}</span>
                </span>
              </div>
              {children}
            </div>
          </div>
        </BrowserFrame>
      </div>
      {note ? (
        <figcaption className="flex flex-wrap items-center gap-2 type-caption">{note}</figcaption>
      ) : null}
    </figure>
  );
}

/** Thin meter used inside previews ("imóveis ativos no plano · 32 de 50"). */
export function UsageMeter({
  label,
  value,
  max,
  valueLabel,
  className,
}: {
  label: ReactNode;
  value: number;
  max: number;
  /** "32 de 50". */
  valueLabel: ReactNode;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-control border border-line p-2', className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] leading-4">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono font-semibold tabular">{valueLabel}</span>
      </div>
      <div className="h-1.5 rounded-pill bg-subtle">
        <div className="h-full rounded-pill bg-action" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
