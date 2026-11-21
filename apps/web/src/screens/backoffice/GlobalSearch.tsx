'use client';

import { cn } from '@casvitta/ui';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { useStaffSearch, type SearchHit } from '@/lib/data/staff';

/** Where each kind of result opens (visible paths on the admin host). */
export function hitHref(hit: SearchHit): string {
  switch (hit.kind) {
    case 'account':
      return `/contas/${hit.id}`;
    case 'creci':
      return `/creci?perfil=${hit.id}`;
    case 'person':
      return `/captacoes?pedido=${hit.id}`;
  }
}

const GROUPS: SearchHit['kind'][] = ['account', 'creci', 'person'];

/** Debounced value: one search (and one audit entry) per pause in typing, not per key. */
function useDebounced(value: string, ms = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Top-bar search (accounts, CRECI, people from captures). ARIA combobox: arrows move through the
 * results, Enter opens one, Esc closes. Contacts in results are masked by the API.
 */
export function GlobalSearch() {
  const t = useTranslations('backoffice.search');
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text);
  const search = useStaffSearch(q);

  const hits = useMemo(() => {
    const all = search.data?.hits ?? [];
    return GROUPS.flatMap((g) => all.filter((h) => h.kind === g));
  }, [search.data]);

  const show = open && text.trim().length >= 2;
  const go = (hit: SearchHit) => {
    setOpen(false);
    setText('');
    router.push(hitHref(hit));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (hits.length ? (i + 1) % hits.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (hits.length ? (i - 1 + hits.length) % hits.length : 0));
    } else if (event.key === 'Enter' && show && hits[active]) {
      event.preventDefault();
      go(hits[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const listId = `${id}-results`;
  const optionId = (i: number) => `${id}-option-${i}`;

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="sr-only">
        {t('label')}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-muted"
      />
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && hits[active] ? optionId(active) : undefined}
        autoComplete="off"
        placeholder={t('placeholder')}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-control border border-line bg-panel pr-3 pl-10 type-body text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
      />
      {show ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-[420px] overflow-y-auto rounded-card border border-line bg-panel p-2 shadow-lg">
          <p className="sr-only" role="status">
            {search.isFetching ? t('searching') : t('results', { count: hits.length })}
          </p>
          {search.isError ? (
            <p className="px-2 py-2 type-body-s text-danger">{t('error')}</p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-2 type-body-s text-fg-muted">
              {search.isFetching || q !== text
                ? t('searching')
                : t('empty', { query: text.trim() })}
            </p>
          ) : null}
          <ul id={listId} role="listbox" aria-label={t('label')}>
            {GROUPS.map((group) => {
              const items = hits.filter((h) => h.kind === group);
              if (items.length === 0) return null;
              return (
                <li key={group} role="presentation">
                  <p aria-hidden="true" className="px-2 pt-2 pb-1 type-eyebrow text-fg-muted">
                    {t(`groups.${group}`)}
                  </p>
                  <ul role="group" aria-label={t(`groups.${group}`)}>
                    {items.map((hit) => {
                      // hits are already in group order, so this is the option's position.
                      const i = hits.indexOf(hit);
                      return (
                        <li
                          key={`${hit.kind}-${hit.id}`}
                          id={optionId(i)}
                          role="option"
                          aria-selected={i === active}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => go(hit)}
                          onMouseEnter={() => setActive(i)}
                          className={cn(
                            'flex min-h-11 cursor-pointer flex-col justify-center rounded-control px-2 py-1.5',
                            i === active && 'bg-action-subtle',
                          )}
                        >
                          <span className="type-body-s font-semibold text-fg">{hit.title}</span>
                          <span className="type-caption">{hit.subtitle}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
