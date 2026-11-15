'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './DropdownMenu.tsx';

export type KanbanColumn<Item> = {
  key: string;
  title: string;
  items: Item[];
  /** Cards shown before "+N" (defaults to `visiblePerColumn`). */
  visibleCount?: number;
};

export type KanbanBoardProps<Item> = {
  label: string;
  columns: KanbanColumn<Item>[];
  itemKey: (item: Item) => string;
  itemLabel: (item: Item) => string;
  renderItem: (item: Item, menu: ReactNode) => ReactNode;
  onMove: (itemKey: string, toColumn: string) => void;
  /** Cards visible per column before "+N"; the rest expand on click. */
  visiblePerColumn?: number;
  copy: {
    moveTo: string; // "Mover para…"
    moveMenuLabel: (item: string) => string; // "Mover Lucas F. para…"
    showMore: (count: number) => string; // "+4 leads"
    showLess: string;
    moved: (item: string, column: string) => string; // live announcement
    empty: string;
  };
  className?: string;
};

const DRAG_TYPE = 'application/x-casvitta-card';

/**
 * Kanban with two ways to move a card: drag and drop, or the keyboard-operable "Mover para…" menu
 * on every card (CLAUDE.md §3 accessibility). Moves are announced in a live region.
 */
export function KanbanBoard<Item>({
  label,
  columns,
  itemKey,
  itemLabel,
  renderItem,
  onMove,
  visiblePerColumn = 2,
  copy,
  className,
}: KanbanBoardProps<Item>) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [over, setOver] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const move = (key: string, name: string, to: KanbanColumn<Item>) => {
    onMove(key, to.key);
    setAnnouncement(copy.moved(name, to.title));
  };

  const onDrop = (event: DragEvent, column: KanbanColumn<Item>) => {
    event.preventDefault();
    setOver(null);
    const [key, name] = (event.dataTransfer.getData(DRAG_TYPE) || '').split('\u0000');
    if (key) move(key, name ?? '', column);
  };

  return (
    <div className={cn('relative', className)}>
      <div role="list" aria-label={label} className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => {
          const isExpanded = expanded[column.key] ?? false;
          const visible = isExpanded
            ? column.items
            : column.items.slice(0, column.visibleCount ?? visiblePerColumn);
          const hidden = column.items.length - visible.length;
          return (
            <section
              key={column.key}
              role="listitem"
              aria-label={`${column.title}, ${column.items.length}`}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                  e.preventDefault();
                  setOver(column.key);
                }
              }}
              onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
              onDrop={(e) => onDrop(e, column)}
              className={cn(
                'flex w-[220px] shrink-0 flex-col gap-2 self-start rounded-card bg-subtle p-2 transition-shadow',
                over === column.key && 'shadow-[inset_0_0_0_2px_var(--color-action)]',
              )}
            >
              <header className="flex items-center justify-between px-1.5 pt-1.5 pb-1">
                <h2 className="type-body-s font-semibold">{column.title}</h2>
                <span className="font-mono type-body-s text-fg-muted">{column.items.length}</span>
              </header>
              <ul className="flex flex-col gap-2">
                {visible.map((item) => {
                  const key = itemKey(item);
                  const name = itemLabel(item);
                  const menu = (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={copy.moveMenuLabel(name)}
                        className="hit-area-44 rounded-chip p-0.5 text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        <MoreHorizontal aria-hidden="true" strokeWidth={1.6} className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>{copy.moveTo}</DropdownMenuLabel>
                        {columns
                          .filter((c) => c.key !== column.key)
                          .map((target) => (
                            <DropdownMenuItem
                              key={target.key}
                              onSelect={() => move(key, name, target)}
                            >
                              {target.title}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                  return (
                    <li
                      key={key}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, `${key}\u0000${name}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      {renderItem(item, menu)}
                    </li>
                  );
                })}
              </ul>
              {column.items.length === 0 ? (
                <p className="rounded-control border border-dashed border-line-dashed px-3 py-4 text-center type-caption">
                  {copy.empty}
                </p>
              ) : null}
              {hidden > 0 || isExpanded ? (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded((s) => ({ ...s, [column.key]: !isExpanded }))}
                  className="min-h-9 rounded-control px-1.5 text-left type-body-s text-fg-muted hover:bg-panel hover:text-fg"
                >
                  {isExpanded ? copy.showLess : copy.showMore(hidden)}
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
