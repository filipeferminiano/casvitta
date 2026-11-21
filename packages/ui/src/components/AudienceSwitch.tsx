import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type AudienceSwitchItem = {
  key: string;
  href: string;
  /** "Para proprietários" (nav). */
  label: string;
  /** "proprietários" (phone tab row); falls back to `label`. */
  shortLabel?: string;
  current: boolean;
};

export type AudienceSwitchProps = {
  items: AudienceSwitchItem[];
  /** Accessible name of the navigation ("Páginas por público"). */
  label: string;
  /** nav = header items (desktop); tabs = 3-tab row under the header (phones). */
  variant: 'nav' | 'tabs';
  /** Injects the router link (e.g. Next's Link); defaults to a plain <a>. */
  renderLink?: (props: {
    href: string;
    className: string;
    'aria-current'?: 'page';
    children: ReactNode;
  }) => ReactNode;
  className?: string;
};

const defaultLink: NonNullable<AudienceSwitchProps['renderLink']> = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

/**
 * Switches between the audience pages (owners, brokers, agencies). Links, not ARIA tabs: each
 * item is its own page, marked with aria-current.
 */
export function AudienceSwitch({
  items,
  label,
  variant,
  renderLink = defaultLink,
  className,
}: AudienceSwitchProps) {
  const tabs = variant === 'tabs';
  return (
    <nav aria-label={label} className={className}>
      <ul className={cn('flex', tabs ? 'w-full border-b border-line bg-panel' : 'gap-1')}>
        {items.map((item) => (
          <li key={item.key} className={cn(tabs && 'flex-1')}>
            {renderLink({
              href: item.href,
              'aria-current': item.current ? 'page' : undefined,
              className: cn(
                'flex min-h-11 items-center justify-center type-body-s focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                tabs
                  ? cn(
                      'border-b-2 px-2 text-center',
                      item.current
                        ? 'border-action font-semibold text-action-hover'
                        : 'border-transparent font-medium text-fg-strong hover:text-fg',
                    )
                  : cn(
                      'rounded-control px-3 font-medium text-fg hover:bg-subtle',
                      item.current && 'bg-action-subtle font-semibold text-action-hover',
                    ),
              ),
              children: tabs ? (item.shortLabel ?? item.label) : item.label,
            })}
          </li>
        ))}
      </ul>
    </nav>
  );
}
