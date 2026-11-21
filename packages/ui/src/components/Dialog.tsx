'use client';

import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { useRef, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  /** Buttons, right-aligned under the content. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Modal dialog on Radix: focus moves in on open, is trapped while open and returns on close to
 * whatever had focus when it opened (the dialog is controlled, so there is no Radix trigger to
 * return to); Esc closes.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  className,
}: DialogProps) {
  const returnTo = useRef<HTMLElement | null>(null);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
        <RadixDialog.Content
          onOpenAutoFocus={() => {
            // Runs before focus moves in: remember where to come back to.
            const active = document.activeElement;
            returnTo.current = active instanceof HTMLElement ? active : null;
          }}
          onCloseAutoFocus={(event) => {
            const target = returnTo.current;
            returnTo.current = null;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
            'rounded-card border border-line bg-panel p-6 shadow-lg focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <RadixDialog.Title className="type-title text-[20px] leading-7">{title}</RadixDialog.Title>
            <RadixDialog.Close
              aria-label={closeLabel}
              className="-mt-1 -mr-2 flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X aria-hidden="true" className="size-5" />
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="mt-1 type-body-s text-fg-muted">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
