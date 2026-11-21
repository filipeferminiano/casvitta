'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { Button } from './Button.tsx';
import { Chip } from './Chip.tsx';

export type ActiveFilter = {
  key: string;
  /** "2+ quartos". */
  label: string;
  /** "Remover 2+ quartos". */
  removeLabel: string;
};

export type FilterBarProps = {
  /** Desktop inline controls (dropdowns, segmented controls), rendered as given. */
  controls: ReactNode;
  active: ActiveFilter[];
  onRemove: (key: string) => void;
  clearLabel: string;
  onClear: () => void;
  /** Mobile button "Filtros", shown with the active count. */
  filtersLabel: string;
  /** Opens the mobile FilterSheet. */
  onOpenSheet: () => void;
  className?: string;
};

/** Desktop: inline filters + active chips. Mobile: "Filtros (n)" button + the same chips. */
export function FilterBar({
  controls,
  active,
  onRemove,
  clearLabel,
  onClear,
  filtersLabel,
  onOpenSheet,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="hidden flex-wrap items-end gap-3 md:flex">{controls}</div>
      <div className="flex items-center gap-2 overflow-x-auto md:hidden">
        <Button variant="secondary" size="sm" onClick={onOpenSheet} className="shrink-0">
          <SlidersHorizontal aria-hidden="true" strokeWidth={1.6} className="size-4" />
          {filtersLabel}
          {active.length ? (
            <span className="rounded-pill bg-fg px-1.5 font-mono type-caption text-white tabular">
              {active.length}
            </span>
          ) : null}
        </Button>
      </div>
      {active.length ? (
        <ul className="flex flex-wrap items-center gap-2">
          {active.map((filter) => (
            <li key={filter.key}>
              <Chip onRemove={() => onRemove(filter.key)} removeLabel={filter.removeLabel}>
                {filter.label}
              </Chip>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 px-1 type-body-s font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {clearLabel}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export type FilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Filtros". */
  title: string;
  closeLabel: string;
  /** Filter sections (Tipo, Quartos, Aluguel total por mês, Vagas…). */
  children: ReactNode;
  clearLabel: string;
  onClear: () => void;
  /** "Ver 5 anúncios" (live count from the caller). */
  applyLabel: string;
  onApply: () => void;
};

/** Mobile bottom sheet with the filters; the apply button shows the live result count. */
export function FilterSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
  clearLabel,
  onClear,
  applyLabel,
  onApply,
}: FilterSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-card border-t border-line bg-panel focus-visible:outline-none">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="type-body font-semibold text-fg">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="inline-flex size-11 items-center justify-center rounded-control text-fg hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X aria-hidden="true" strokeWidth={1.6} className="size-5" />
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">{children}</div>
          <footer className="flex gap-3 border-t border-line p-4">
            <Button variant="secondary" onClick={onClear} className="flex-1">
              {clearLabel}
            </Button>
            <Button onClick={onApply} className="flex-[2]">
              {applyLabel}
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
