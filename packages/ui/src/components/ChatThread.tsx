'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ChatItem =
  | {
      kind: 'message';
      id: string;
      /** "in" = from the lead (white, left); "out" = AI or broker (ink-900, right). */
      side: 'in' | 'out';
      text: ReactNode;
      /** Mono meta line, e.g. "IA · 14h03". */
      meta: ReactNode;
      /** Marks AI-written messages with a spark before the meta. */
      ai?: boolean;
    }
  | { kind: 'event'; id: string; text: ReactNode; tone?: 'neutral' | 'attention' | 'success' };

export type ChatThreadProps = {
  /** Accessible name of the message log. */
  label: string;
  items: ChatItem[];
  header?: ReactNode;
  /** Classes for the header bar (e.g. hide it on phones). */
  headerClassName?: string;
  footer?: ReactNode;
  className?: string;
  /** Scroll to the latest message when items change. */
  autoScroll?: boolean;
};

const eventTones = {
  neutral: 'border-line bg-panel text-fg-strong',
  attention: 'border-attention-line bg-attention-subtle text-attention-fg',
  success: 'border-success/30 bg-success-subtle text-success',
};

/** WhatsApp-style thread (DESIGN_SYSTEM §6): chat-bg, bubbles, centered system pills. */
export function ChatThread({
  label,
  items,
  header,
  headerClassName,
  footer,
  className,
  autoScroll = true,
}: ChatThreadProps) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll only the log, never the page.
    if (autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [items.length, autoScroll]);

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-panel',
        className,
      )}
    >
      {header ? (
        <header className={cn('border-b border-line px-4 py-3', headerClassName)}>{header}</header>
      ) : null}
      <div
        ref={logRef}
        role="log"
        aria-label={label}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-chat-bg px-4 py-5"
      >
        {items.map((item) =>
          item.kind === 'event' ? (
            <p
              key={item.id}
              className={cn(
                'mx-auto max-w-[90%] rounded-pill border px-3 py-1 text-center text-[12px] leading-4',
                eventTones[item.tone ?? 'neutral'],
              )}
            >
              {item.text}
            </p>
          ) : (
            <div
              key={item.id}
              className={cn(
                'flex max-w-[78%] flex-col gap-1 px-3 py-2.5',
                item.side === 'in'
                  ? 'self-start rounded-[4px_10px_10px_10px] bg-panel text-fg'
                  : 'self-end rounded-[10px_4px_10px_10px] bg-fg text-white',
              )}
            >
              <p className="type-body-s whitespace-pre-line">{item.text}</p>
              <p
                className={cn(
                  'flex items-center gap-1 font-mono text-[10.5px] leading-3',
                  item.side === 'in' ? 'text-fg-muted' : 'text-ink-300',
                )}
              >
                {item.ai ? (
                  <Sparkles aria-hidden="true" strokeWidth={1.6} className="size-3" />
                ) : null}
                {item.meta}
              </p>
            </div>
          ),
        )}
      </div>
      {footer ? <footer className="border-t border-line bg-panel p-3">{footer}</footer> : null}
    </section>
  );
}

export type AiDraftComposerProps = {
  /** "Rascunho da IA · revise antes de enviar". */
  badge: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Guardrail note under the draft. */
  warning?: ReactNode;
  /** Discard link, top right. */
  discard?: ReactNode;
  actions: ReactNode;
};

/** The AI's suggested reply: blue border, must be reviewed before sending. */
export function AiDraftComposer({
  badge,
  label,
  value,
  onChange,
  warning,
  discard,
  actions,
}: AiDraftComposerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        {badge}
        {discard}
      </div>
      <label className="sr-only" htmlFor="ai-draft">
        {label}
      </label>
      <textarea
        id="ai-draft"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full resize-y rounded-control border-2 border-action bg-panel px-3 py-2 type-body text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      {warning ? <p className="type-caption">{warning}</p> : null}
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
