'use client';

import {
  Badge,
  Button,
  cardLinkClass,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  EstimateBox,
  filterChipClass,
  MapPins,
  PropertyCard,
  useToast,
} from '@casvitta/ui';
import { ChevronDown, SearchX, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { CreciBadge, DemoBadge, SponsoredBadge } from '@/components/badges';
import { track } from '@/lib/analytics';
import type { SearchResult } from '@/lib/data/marketplace';
import { formatBRL, formatBRLShort, formatPercent } from '@/lib/format';
import {
  filtersToQuery,
  searchPath,
  withFilters,
  type SearchFilters,
  type SortKey,
} from '@/lib/search-params';

import { ListingJsonLd } from './ListingJsonLd';

const SORTS: SortKey[] = ['relevance', 'price_asc', 'price_desc', 'newest'];

type AppliedChip = { key: string; label: string; href: string };
type MoreOption = { key: string; label: string; patch: Partial<SearchFilters> };
const compact = <T,>(items: (T | null)[]): T[] => items.filter((i): i is T => i !== null);

/** Mockup 53: filter chips (in the URL), list + map, sponsored first, sort, save search. */
export function SearchScreen({
  filters,
  results,
}: {
  filters: SearchFilters;
  results: SearchResult[];
}) {
  const t = useTranslations('search');
  const tKinds = useTranslations('listing.kinds');
  const router = useRouter();
  const toast = useToast();
  const [hovered, setHovered] = useState<string | null>(null);
  const place = filters.where?.split(',')[0]?.trim();
  const query = filtersToQuery(filters);
  const { where, transaction, invest } = filters;
  const count = results.length;
  useEffect(() => {
    track({
      name: 'view_search_results',
      search_term: where ?? '',
      transaction,
      results_count: count,
      invest_mode: invest,
      filters: query,
    });
  }, [query, where, transaction, invest, count]);

  const applied = compact<AppliedChip>([
    filters.where
      ? { key: 'where', label: filters.where, href: withFilters(filters, { where: null }) }
      : null,
    filters.kind
      ? { key: 'kind', label: tKinds(filters.kind), href: withFilters(filters, { kind: null }) }
      : null,
    filters.minBedrooms
      ? {
          key: 'bedrooms',
          label: t('chips.bedrooms', { n: filters.minBedrooms }),
          href: withFilters(filters, { minBedrooms: null }),
        }
      : null,
    filters.maxPriceCents
      ? {
          key: 'max',
          label: t('chips.upTo', { amount: formatBRLShort(filters.maxPriceCents) }),
          href: withFilters(filters, { maxPriceCents: null }),
        }
      : null,
    filters.fgts
      ? { key: 'fgts', label: t('chips.fgts'), href: withFilters(filters, { fgts: false }) }
      : null,
    filters.metro
      ? { key: 'metro', label: t('chips.metro'), href: withFilters(filters, { metro: false }) }
      : null,
    filters.pet
      ? { key: 'pet', label: t('chips.pet'), href: withFilters(filters, { pet: false }) }
      : null,
  ]);

  const more = compact<MoreOption>([
    !filters.fgts ? { key: 'fgts', label: t('chips.fgts'), patch: { fgts: true } } : null,
    !filters.metro ? { key: 'metro', label: t('chips.metro'), patch: { metro: true } } : null,
    !filters.pet ? { key: 'pet', label: t('chips.pet'), patch: { pet: true } } : null,
    !filters.minBedrooms
      ? { key: 'bedrooms', label: t('chips.bedrooms', { n: 2 }), patch: { minBedrooms: 2 } }
      : null,
    !filters.kind ? { key: 'house', label: tKinds('house'), patch: { kind: 'house' } } : null,
    !filters.kind
      ? { key: 'apartment', label: tKinds('apartment'), patch: { kind: 'apartment' } }
      : null,
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:px-8 xl:px-20">
      <h1 className="sr-only">{t('title', { transaction: filters.transaction })}</h1>
      <nav aria-label={t('filtersLabel')} className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className={filterChipClass(false) + ' border-fg'}>
            {filters.transaction === 'rent' ? t('rent') : t('buy')}
            <ChevronDown aria-hidden="true" strokeWidth={1.6} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() =>
                router.push(searchPath({ ...filters, transaction: 'sale', invest: filters.invest }))
              }
            >
              {t('buy')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                router.push(searchPath({ ...filters, transaction: 'rent', invest: false }))
              }
            >
              {t('rent')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {applied.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            className={filterChipClass(true)}
            aria-label={t('removeFilter', { filter: chip.label })}
          >
            {chip.label}
            <span aria-hidden="true">{'×'}</span>
          </Link>
        ))}
        {more.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={filterChipClass(false)}>
              {t('moreFilters')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {more.map((m) => (
                <DropdownMenuItem
                  key={m.key}
                  onSelect={() => router.push(withFilters(filters, m.patch))}
                >
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {filters.transaction === 'sale' ? (
          <Link
            href={withFilters(filters, { invest: !filters.invest })}
            aria-pressed={filters.invest}
            className={filterChipClass(filters.invest)}
          >
            <TrendingUp aria-hidden="true" strokeWidth={1.6} className="size-4" />
            {t('investMode')}
          </Link>
        ) : null}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-body-s text-fg-strong" aria-live="polite">
          {t.rich('count', {
            count: results.length,
            transaction: filters.transaction,
            place: place ?? '',
            hasPlace: String(Boolean(place)),
            strong: (c) => <strong className="text-fg">{c}</strong>,
          })}
          {results.some((r) => r.property.isDemo) ? (
            <span className="text-fg-muted">{` · ${t('demoNote')}`}</span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="search-sort" className="type-body-s text-fg-muted">
            {t('sortBy')}
          </label>
          <select
            id="search-sort"
            value={filters.sort}
            onChange={(e) => router.push(withFilters(filters, { sort: e.target.value as SortKey }))}
            className="h-10 rounded-control border border-line bg-subtle px-3 type-body-s focus-visible:outline-2 focus-visible:outline-focus"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            className="border-line"
            onClick={() => {
              track({ name: 'save_search', transaction: filters.transaction });
              toast({ title: t('savedTitle'), description: t('savedDescription') });
            }}
          >
            {t('save')}
          </Button>
        </div>
      </div>

      {filters.invest ? <p className="type-body-s text-fg-strong">{t('investNote')}</p> : null}

      {results.length === 0 ? (
        <EmptyState
          icon={<SearchX strokeWidth={1.6} />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          actions={
            <Button asChild variant="secondary">
              <Link
                href={searchPath({
                  ...filters,
                  where: null,
                  kind: null,
                  maxPriceCents: null,
                  minBedrooms: null,
                  fgts: false,
                  metro: false,
                  pet: false,
                })}
              >
                {t('clear')}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {results.map((r) => (
                <li
                  key={r.property.id}
                  onMouseEnter={() => setHovered(r.property.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <ListingJsonLd listing={r} url={`/imovel/${r.property.slug}`} />
                  <ResultCard result={r} />
                </li>
              ))}
            </ul>
            <p className="type-body-s text-fg-muted">{t('sponsoredNote')}</p>
          </div>
          <div className="hidden lg:block">
            <MapPins
              className="sticky top-4 h-[620px]"
              label={t('mapLabel', { place: place ?? '' })}
              caption={t('mapLabel', { place: place ?? '' })}
              onHover={setHovered}
              pins={results
                .filter((r) => r.property.geo)
                .map((r) => ({
                  id: r.property.id,
                  lat: r.property.geo!.lat,
                  lng: r.property.geo!.lng,
                  label: formatBRLShort(r.property.priceCents).replace('R$ ', ''),
                  highlighted: hovered ? hovered === r.property.id : r.sponsored,
                  href: `/imovel/${r.property.slug}`,
                }))}
              renderLink={(href, className, children) => (
                <Link href={href} className={className}>
                  {children}
                </Link>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ result: r }: { result: SearchResult }) {
  const t = useTranslations('search.card');
  const tKinds = useTranslations('listing.kinds');
  const tListing = useTranslations('listing');
  const p = r.property;
  return (
    <PropertyCard
      layout="horizontal"
      photoCaption={t('photo')}
      badges={
        <>
          {r.sponsored ? <SponsoredBadge /> : null}
          {p.isDemo ? <DemoBadge /> : null}
        </>
      }
      kicker={t('kicker', { kind: tKinds(p.kind), transaction: p.transaction })}
      title={
        <Link href={`/imovel/${p.slug}`} className={cardLinkClass}>
          {`${p.street} · ${p.neighborhood}`}
        </Link>
      }
      price={
        p.transaction === 'rent'
          ? tListing('perMonth', { amount: formatBRL(p.priceCents) })
          : formatBRL(p.priceCents)
      }
      specs={[
        tListing('bedrooms', { count: p.bedrooms }),
        `${p.areaM2} m²`,
        p.parking ? tListing('parking', { count: p.parking }) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      extra={
        <>
          {r.installmentCents ? (
            <p className="type-caption text-fg-strong">
              {t.rich('installment', {
                amount: formatBRL(Math.round(r.installmentCents / 100) * 100),
                strong: (c) => <strong className="font-mono text-fg">{c}</strong>,
              })}
            </p>
          ) : null}
          {r.estimate ? (
            <EstimateBox
              className="mt-2"
              badge={<Badge variant="simulation">{t('estimateBadge')}</Badge>}
              basis={t('estimateBasis', { count: r.estimate.comparables })}
              rows={[
                {
                  key: 'rent',
                  label: t('estimatedRent'),
                  value: tListing('perMonth', { amount: formatBRL(r.estimate.monthlyRentCents) }),
                },
                {
                  key: 'yield',
                  label: t('grossYield'),
                  value: t('perYear', { pct: formatPercent(r.estimate.grossYield) }),
                },
              ]}
            />
          ) : null}
        </>
      }
      broker={
        <>
          <span>{r.broker.displayName}</span>
          <CreciBadge broker={r.broker} />
        </>
      }
    />
  );
}
