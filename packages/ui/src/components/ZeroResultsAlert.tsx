import { BellRing } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ZeroResultsAlertProps = {
  /** "Ainda não há apartamentos para alugar na Rua Joaquim Távora." */
  title: ReactNode;
  /** What the alert does, without promising a time or a result. */
  description?: ReactNode;
  /** LeadAlertForm with the filters as chips: the main element of the page. */
  form: ReactNode;
  /** Links to the neighborhood and nearby streets (with real counts). */
  links?: { key: string; label: ReactNode; href: string }[];
  /** Accessible name of the links list, e.g. "Veja também". */
  linksLabel?: string;
  className?: string;
};

/** Zero listings: no placeholder cards. The alert is the main element, plus links nearby. */
export function ZeroResultsAlert({
  title,
  description,
  form,
  links,
  linksLabel,
  className,
}: ZeroResultsAlertProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-5 rounded-card border border-dashed border-line-dashed bg-panel p-5',
        className,
      )}
    >
      <div className="flex gap-3">
        <BellRing aria-hidden="true" strokeWidth={1.6} className="size-6 shrink-0 text-fg-muted" />
        <div className="flex flex-col gap-1">
          <h2 className="type-body font-semibold text-fg">{title}</h2>
          {description ? <p className="type-body-s text-fg-muted">{description}</p> : null}
        </div>
      </div>
      {form}
      {links?.length ? (
        <nav aria-label={linksLabel}>
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.key}>
                <a
                  href={link.href}
                  className="inline-flex min-h-11 items-center type-body-s font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
