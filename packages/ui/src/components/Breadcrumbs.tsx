import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type BreadcrumbItem = { label: ReactNode; href?: string };

export type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  /** Accessible name of the navigation landmark, e.g. "Você está em". */
  label: string;
  /** Injects the router link (e.g. Next's Link); defaults to a plain <a>. */
  renderLink?: (href: string, children: ReactNode) => ReactNode;
  className?: string;
};

const linkClass =
  'inline-flex min-h-11 items-center text-action underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus rounded-chip';

/** São Paulo › Bairro › Rua › Prédio. The last item is the current page and is not a link. */
export function Breadcrumbs({ items, label, renderLink, className }: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className={cn('type-body-s', className)}>
      <ol className="flex flex-wrap items-center gap-x-1 text-fg-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {isLast || !item.href ? (
                <span
                  className={cn('inline-flex min-h-11 items-center', isLast && 'text-fg')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : renderLink ? (
                renderLink(item.href, <span className={linkClass}>{item.label}</span>)
              ) : (
                <a href={item.href} className={linkClass}>
                  {item.label}
                </a>
              )}
              {isLast ? null : (
                <ChevronRight aria-hidden="true" strokeWidth={1.6} className="size-4 shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
