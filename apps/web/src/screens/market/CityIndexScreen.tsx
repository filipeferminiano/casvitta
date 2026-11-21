import { DataTable, StatTile, ZoneFilter } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { CityIndexPage, NeighborhoodRow } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import { formatChange, formatPriceM2, formatWindowMonth } from '@/lib/market-format';

import { JsonLd, breadcrumbList } from './MarketJsonLd';
import {
  ContinueLinks,
  MarketBreadcrumbs,
  PriceM2Label,
  SourceLine,
  linkClass,
  pageClass,
} from './MarketParts';

export const ZONES = ['centro', 'sul', 'oeste', 'norte', 'leste'] as const;
export type Zone = (typeof ZONES)[number];
export type CitySort = 'preco' | 'vendas' | 'nome';
export type CityQuery = { q: string; zona: Zone | null; ordem: CitySort; mostrar: number };

const PAGE_SIZE = 25;

/** ?q=pin&zona=sul&ordem=preco&mostrar=50 -> query (unknown values fall back to defaults). */
export function parseCityQuery(params: Record<string, string | string[] | undefined>): CityQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? '';
  };
  const zona = one('zona') as Zone;
  const ordem = one('ordem') as CitySort;
  const mostrar = Number(one('mostrar'));
  return {
    q: one('q').trim().slice(0, 60),
    zona: (ZONES as readonly string[]).includes(zona) ? zona : null,
    ordem: ['preco', 'vendas', 'nome'].includes(ordem) ? ordem : 'preco',
    mostrar: Number.isInteger(mostrar) && mostrar > 0 ? Math.min(mostrar, 500) : PAGE_SIZE,
  };
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function filterRows(rows: NeighborhoodRow[], query: CityQuery): NeighborhoodRow[] {
  const q = fold(query.q);
  const filtered = rows.filter(
    (row) => (!q || fold(row.place.name).includes(q)) && (!query.zona || row.zone === query.zona),
  );
  const price = (r: NeighborhoodRow) => r.stats?.median_price_m2_cents ?? -1;
  const sales = (r: NeighborhoodRow) => r.stats?.sales ?? -1;
  return [...filtered].sort((a, b) => {
    if (query.ordem === 'nome') return a.place.name.localeCompare(b.place.name, 'pt-BR');
    const diff = query.ordem === 'vendas' ? sales(b) - sales(a) : price(b) - price(a);
    return diff || a.place.name.localeCompare(b.place.name, 'pt-BR');
  });
}

function href(base: string, query: CityQuery, patch: Partial<CityQuery>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.zona) params.set('zona', next.zona);
  if (next.ordem !== 'preco') params.set('ordem', next.ordem);
  if (next.mostrar !== PAGE_SIZE) params.set('mostrar', String(next.mostrar));
  const text = params.toString();
  return text ? `${base}?${text}` : base;
}

/** 04b · /preco-m2/{cidade}: works without JS (filters and sort are links/forms). */
export async function CityIndexScreen({ page, query }: { page: CityIndexPage; query: CityQuery }) {
  const t = await getTranslations('market.city');
  const tMarket = await getTranslations('market');
  const stats = page.stats;
  const base = page.city.path;
  const rows = filterRows(page.neighborhoods, query);
  const shown = rows.slice(0, query.mostrar);
  const windowEnd = page.source.window_end ? formatWindowMonth(page.source.window_end) : '';
  const sortLabel = t(`sort.${query.ordem}`);

  return (
    <div className={pageClass}>
      <JsonLd data={breadcrumbList([page.city])} />
      <MarketBreadcrumbs
        items={[page.city]}
        label={tMarket('breadcrumbLabel')}
        demo={page.source.is_demo}
      />
      <header className="flex flex-col gap-3">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        <h1 className="type-display-l">{t('title', { city: page.city.name })}</h1>
        {stats?.priced &&
        stats.median_value_cents != null &&
        stats.median_price_m2_cents != null ? (
          <p className="max-w-[65ch] type-body text-fg-strong" data-testid="lead">
            {t('lead', {
              sales: stats.sales.toLocaleString('pt-BR'),
              city: page.city.name,
              value: formatBRL(stats.median_value_cents),
              price: formatPriceM2(stats.median_price_m2_cents),
            })}
          </p>
        ) : null}
      </header>

      {stats?.priced ? (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t('tiles.sales', { city: page.city.name })}
            value={stats.sales.toLocaleString('pt-BR')}
            caption={t('tiles.window', { end: windowEnd })}
          />
          <StatTile
            label={t('tiles.medianValue')}
            value={stats.median_value_cents != null ? formatBRL(stats.median_value_cents) : '—'}
            caption={t('tiles.city')}
          />
          <StatTile
            highlighted
            label={<PriceM2Label />}
            value={
              stats.median_price_m2_cents != null ? formatPriceM2(stats.median_price_m2_cents) : '—'
            }
            caption={
              stats.median_price_m2_change_12m_pct != null
                ? t('tiles.change', { change: formatChange(stats.median_price_m2_change_12m_pct) })
                : undefined
            }
          />
          <StatTile
            label={t('tiles.withPrice')}
            value={String(page.neighborhoods_with_price)}
            caption={t('tiles.withPriceCaption')}
          />
        </div>
      ) : null}

      <section aria-labelledby="bairros" className="flex flex-col gap-4">
        <h2 id="bairros" className="sr-only">
          {t('tableCaption', { city: page.city.name })}
        </h2>
        <form action={base} method="get" role="search" className="flex flex-wrap items-end gap-2">
          {query.zona ? <input type="hidden" name="zona" value={query.zona} /> : null}
          {query.ordem !== 'preco' ? (
            <input type="hidden" name="ordem" value={query.ordem} />
          ) : null}
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 type-body-s">
            <span className="font-semibold">{t('search')}</span>
            <input
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder={t('searchPlaceholder')}
              className="min-h-11 rounded-control border border-line bg-panel px-3 type-body"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-control border border-fg bg-panel px-4 type-body-s font-semibold hover:bg-subtle"
          >
            {t('searchSubmit')}
          </button>
        </form>
        <ZoneFilter
          label={t('zone')}
          options={[
            {
              key: 'todas',
              label: t('zones.todas'),
              href: href(base, query, { zona: null }),
              selected: !query.zona,
            },
            ...ZONES.map((zone) => ({
              key: zone,
              label: t(`zones.${zone}`),
              href: href(base, query, { zona: zone }),
              selected: query.zona === zone,
            })),
          ]}
        />
        <p className="type-caption" aria-live="polite">
          {t('showing', { shown: shown.length, total: rows.length, sort: sortLabel })}{' '}
          {(['preco', 'vendas', 'nome'] as const)
            .filter((o) => o !== query.ordem)
            .map((o) => (
              <Link key={o} href={href(base, query, { ordem: o })} className={`${linkClass} ml-2`}>
                {t(`sortBy.${o}`)}
              </Link>
            ))}
        </p>
        <DataTable<NeighborhoodRow>
          caption={t('tableCaption', { city: page.city.name })}
          rows={shown}
          rowKey={(row) => row.place.slug}
          empty={<p className="p-4 type-body-s text-fg-muted">{t('empty')}</p>}
          columns={[
            {
              key: 'name',
              header: t('neighborhood'),
              cell: (row) => (
                <Link href={row.place.path} className={linkClass}>
                  {row.place.name}
                </Link>
              ),
            },
            {
              key: 'priceM2',
              header: t('priceM2'),
              numeric: true,
              cell: (row) =>
                row.stats?.median_price_m2_cents != null
                  ? formatPriceM2(row.stats.median_price_m2_cents)
                  : tMarket('fewSales'),
            },
            {
              key: 'value',
              header: t('medianValue'),
              numeric: true,
              className: 'hidden sm:table-cell',
              cell: (row) =>
                row.stats?.median_value_cents != null
                  ? formatBRL(row.stats.median_value_cents)
                  : '—',
            },
            {
              key: 'sales',
              header: t('sales'),
              numeric: true,
              className: 'hidden md:table-cell',
              cell: (row) => (row.stats ? row.stats.sales.toLocaleString('pt-BR') : '—'),
            },
            {
              key: 'change',
              header: t('change'),
              numeric: true,
              cell: (row) =>
                row.stats?.median_price_m2_change_12m_pct != null
                  ? formatChange(row.stats.median_price_m2_change_12m_pct)
                  : '—',
            },
          ]}
        />
        {rows.length > shown.length ? (
          <Link
            href={href(base, query, { mostrar: query.mostrar + PAGE_SIZE })}
            className="inline-flex min-h-11 items-center justify-center self-start rounded-control border border-fg bg-panel px-5 type-body-s font-semibold hover:bg-subtle"
          >
            {t('showMore')}
          </Link>
        ) : null}
        <SourceLine source={page.source} />
      </section>

      <ContinueLinks
        groups={[
          {
            title: t('continue.tools'),
            links: [
              { href: '/quanto-vale-meu-imovel', label: t('continue.valuation') },
              { href: `/itbi/${page.city.slug}`, label: t('continue.itbi') },
            ],
          },
        ]}
      />
    </div>
  );
}
