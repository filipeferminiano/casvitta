'use client';

import { Button, CurrencyInput, SegmentedControl, Select } from '@casvitta/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { PropertyKind, Transaction } from '@/domain/types';
import { track } from '@/lib/analytics';
import { parseFilters, searchPath } from '@/lib/search-params';

const SHORTCUTS = [
  { key: 'fgts', query: 'fgts=1' },
  { key: 'metro', query: 'metro=1' },
  { key: 'bedrooms', query: 'quartos=2' },
  { key: 'pet', query: 'pet=1' },
] as const;

/** Home search box (51/52): Comprar/Alugar, onde, tipo, até quanto, shortcuts. */
export function HomeSearch() {
  const t = useTranslations('home.search');
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction>('sale');
  const [where, setWhere] = useState('');
  const [kind, setKind] = useState<PropertyKind | 'any'>('any');
  const [max, setMax] = useState<number | null>(null);

  const base = parseFilters(new URLSearchParams(), transaction);
  const path = searchPath({
    ...base,
    where: where.trim() || null,
    kind: kind === 'any' ? null : kind,
    maxPriceCents: max,
  });
  const segment = transaction === 'rent' ? '/alugar' : '/comprar';

  return (
    <form
      role="search"
      aria-label={t('label')}
      className="flex flex-col gap-4 rounded-card border border-line bg-panel p-4 md:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        track({ name: 'search', filters: { transaction, kind, hasWhere: String(Boolean(where)) } });
        router.push(path);
      }}
    >
      <SegmentedControl
        label={t('transaction')}
        className="self-start"
        value={transaction}
        onValueChange={(v) => setTransaction(v as Transaction)}
        options={[
          { value: 'sale', label: t('buy') },
          { value: 'rent', label: t('rent') },
        ]}
      />
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="home-where" className="type-body-s font-medium">
            {t('where')}
          </label>
          <input
            id="home-where"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder={t('wherePlaceholder')}
            className="h-11 rounded-control border border-line bg-panel px-3 type-body focus-visible:outline-2 focus-visible:outline-focus"
          />
        </div>
        <Select
          className="hidden md:flex"
          label={t('kind')}
          value={kind}
          onValueChange={(v) => setKind(v as PropertyKind | 'any')}
          options={[
            { value: 'any', label: t('anyKind') },
            { value: 'apartment', label: t('kinds.apartment') },
            { value: 'house', label: t('kinds.house') },
            { value: 'studio', label: t('kinds.studio') },
          ]}
        />
        <CurrencyInput
          label={t('upTo')}
          value={max}
          onValueChange={setMax}
          placeholder={t('upToPlaceholder')}
        />
        <Button type="submit">{t('submit')}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-caption">{t('shortcuts')}</span>
        {SHORTCUTS.map((s) => (
          <Link
            key={s.key}
            href={`${segment}?${s.query}`}
            className="flex min-h-8 items-center rounded-pill bg-subtle px-3 type-caption font-medium text-fg-strong hover:bg-ink-200"
          >
            {t(`shortcut.${s.key}`)}
          </Link>
        ))}
      </div>
    </form>
  );
}
