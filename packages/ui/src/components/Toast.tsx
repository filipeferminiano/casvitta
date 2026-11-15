'use client';

import { CircleCheck, X } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

type ToastItem = {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  tone: 'success' | 'neutral';
};
type ToastInput = Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastItem['tone'] };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Short confirmation of an action ("Pronto. Avisamos quando chegar."). */
export function useToast(): (toast: ToastInput) => void {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}

export function ToastProvider({
  children,
  closeLabel,
}: {
  children: ReactNode;
  closeLabel: string;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((toast: ToastInput) => {
    setItems((current) => [
      ...current,
      { tone: 'success', ...toast, id: Date.now() + Math.random() },
    ]);
  }, []);
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((current) => current.filter((i) => i.id !== item.id));
            }}
            className={cn(
              'flex items-start gap-3 rounded-card border border-line bg-panel p-4 shadow-menu',
              'data-[swipe=end]:translate-x-full',
            )}
          >
            {item.tone === 'success' ? (
              <CircleCheck
                aria-hidden="true"
                strokeWidth={1.6}
                className="mt-0.5 size-5 shrink-0 text-success"
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <RadixToast.Title className="type-body-s font-semibold text-fg">
                {item.title}
              </RadixToast.Title>
              {item.description ? (
                <RadixToast.Description className="type-body-s text-fg-muted">
                  {item.description}
                </RadixToast.Description>
              ) : null}
            </div>
            <RadixToast.Close
              aria-label={closeLabel}
              className="hit-area-44 rounded-control p-1 text-fg-muted hover:bg-subtle"
            >
              <X aria-hidden="true" strokeWidth={1.6} className="size-4" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed right-4 bottom-20 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 outline-none md:bottom-4" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
