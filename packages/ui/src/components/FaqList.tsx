import { ChevronDown } from 'lucide-react';

import { cn } from '../lib/cn.ts';

export type FaqItem = { key: string; question: string; answer: string };

/**
 * Questions and answers as native <details> (keyboard and screen-reader friendly, no JS).
 * Plain strings on purpose: the same items feed the FAQPage structured data, so what the page
 * shows and what it declares never drift apart.
 */
export function FaqList({
  items,
  defaultOpen = false,
  className,
}: {
  items: FaqItem[];
  /** Open all answers (the mockups show them open). */
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col border-t border-line', className)}>
      {items.map((item) => (
        <details key={item.key} open={defaultOpen} className="group border-b border-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 type-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              aria-hidden="true"
              strokeWidth={1.6}
              className="size-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="max-w-[70ch] pb-4 type-body-s text-fg-strong">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
