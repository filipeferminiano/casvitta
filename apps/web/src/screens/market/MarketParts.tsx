import {
  Breadcrumbs,
  EmptyState,
  NeighborComparisonTable,
  SourceNote,
  StatTile,
  Tooltip,
  type BreadcrumbItem,
} from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { DemoBadge } from '@/components/badges';
import type {
  GateInfo,
  NeighborhoodRow,
  PlaceRef,
  PublicStats,
  SourceInfo,
} from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import { formatChange, formatPriceM2, formatUpdated, formatWindowMonth } from '@/lib/market-format';

export const pageClass = 'mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-6 pb-14 md:px-8 md:pt-10';

export const linkClass =
  'font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** Breadcrumb; the "Demonstrativo" badge sits next to it only for demo data. */
export function MarketBreadcrumbs({
  items,
  label,
  demo = false,
}: {
  items: PlaceRef[];
  label: string;
  demo?: boolean;
}) {
  const crumbs: BreadcrumbItem[] = items.map((item, index) => ({
    label: item.name,
    href: index === items.length - 1 ? undefined : item.path,
  }));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Breadcrumbs
        items={crumbs}
        label={label}
        renderLink={(href, children) => <Link href={href}>{children}</Link>}
      />
      {demo ? <DemoBadge /> : null}
    </div>
  );
}

/** "Fonte: Prefeitura de São Paulo — guias de ITBI · Atualizado em dd/MM/yyyy". */
export async function SourceLine({ source, extra }: { source: SourceInfo; extra?: ReactNode }) {
  const t = await getTranslations('market');
  return (
    <SourceNote
      source={t('source')}
      updated={
        source.refreshed_at ? t('updated', { date: formatUpdated(source.refreshed_at) }) : undefined
      }
      items={extra ? [extra] : []}
    />
  );
}

export async function WindowLabel({ stats }: { stats: PublicStats }) {
  const t = await getTranslations('market');
  return stats.window_start
    ? t('window', {
        start: formatWindowMonth(stats.window_start),
        end: formatWindowMonth(stats.window_end),
      })
    : t('windowAll', { end: formatWindowMonth(stats.window_end) });
}

/** "R$/m² de área construída (IPTU)" with the tooltip every R$/m² must carry. */
export async function PriceM2Label({ short = false }: { short?: boolean }) {
  const t = await getTranslations('market');
  return (
    <span className="inline-flex items-center gap-1">
      {short ? t('priceM2Short') : t('priceM2Label')}
      <Tooltip label={t('priceM2Info')} content={t('priceM2Tooltip')} />
    </span>
  );
}

/** Generic tiles for street/building pages: count always, prices only when priced. */
export async function StatTiles({
  stats,
  salesLabel,
  extra,
}: {
  stats: PublicStats;
  salesLabel: string;
  extra?: ReactNode;
}) {
  const t = await getTranslations('market.stats');
  const tMarket = await getTranslations('market');
  const range =
    stats.p25_price_m2_cents != null && stats.p75_price_m2_cents != null
      ? t('range', {
          low: formatPriceM2(stats.p25_price_m2_cents),
          high: formatPriceM2(stats.p75_price_m2_cents),
        })
      : undefined;
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      <StatTile
        highlighted
        label={t('medianValue')}
        value={stats.median_value_cents != null ? formatBRL(stats.median_value_cents) : '—'}
        caption={stats.priced ? undefined : tMarket('fewSales')}
      />
      <StatTile
        label={<PriceM2Label />}
        value={
          stats.median_price_m2_cents != null ? formatPriceM2(stats.median_price_m2_cents) : '—'
        }
        caption={
          stats.median_price_m2_change_12m_pct != null
            ? t('change', { change: formatChange(stats.median_price_m2_change_12m_pct) })
            : range
        }
      />
      <StatTile
        label={salesLabel}
        value={stats.sales.toLocaleString('pt-BR')}
        caption={
          stats.last_sale_year ? t('lastSaleYear', { year: stats.last_sale_year }) : undefined
        }
      />
      {stats.financed_pct != null ? (
        <StatTile
          label={t('financed')}
          value={`${stats.financed_pct}%`}
          caption={
            stats.median_financed_pct != null
              ? t('financedShare', { pct: stats.median_financed_pct })
              : undefined
          }
        />
      ) : null}
      {extra}
    </div>
  );
}

/**
 * Below the gate: the count ("6 vendas"), never a price, plus links and the neighbors' numbers.
 * The page is noindex,follow.
 */
export async function FewData({
  gate,
  links,
  sales,
  neighbors,
}: {
  gate: GateInfo;
  links: PlaceRef[];
  sales?: number;
  neighbors?: NeighborhoodRow[];
}) {
  const t = await getTranslations('market.fewData');
  const tMarket = await getTranslations('market');
  const window = t(`windows.${gate.window as 'last_12m' | 'last_36m' | 'all'}`);
  return (
    <div className="flex flex-col gap-6">
      <EmptyState
        title={t('title')}
        description={
          sales != null
            ? t('descriptionCount', { sales, min: gate.min_sales, window })
            : t('description', { min: gate.min_sales, window })
        }
        actions={
          links.length ? (
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              {links.map((link) => (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    className="inline-flex min-h-11 items-center type-body-s font-semibold text-action underline-offset-4 hover:underline"
                  >
                    {t('link', { name: link.name })}
                  </Link>
                </li>
              ))}
            </ul>
          ) : undefined
        }
      />
      {neighbors?.some((n) => n.stats) ? (
        <NeighborComparisonTable
          caption={t('neighborsCaption')}
          showCaption
          labels={{
            neighborhood: t('neighborhood'),
            priceM2: tMarket('priceM2Short'),
            change: t('change'),
            current: t('current'),
            fewSales: tMarket('fewSales'),
          }}
          rows={neighbors.map((n) => ({
            key: n.place.slug,
            name: n.place.name,
            href: n.place.path,
            priceM2:
              n.stats?.median_price_m2_cents != null
                ? formatPriceM2(n.stats.median_price_m2_cents)
                : null,
            change:
              n.stats?.median_price_m2_change_12m_pct != null
                ? formatChange(n.stats.median_price_m2_change_12m_pct)
                : null,
          }))}
        />
      ) : null}
    </div>
  );
}

/** "Como calculamos" + source line. */
export async function MethodNote({ source }: { source: SourceInfo }) {
  const t = await getTranslations('market.method');
  return (
    <section aria-labelledby="metodo" className="flex max-w-[65ch] flex-col gap-2">
      <h2 id="metodo" className="type-title">
        {t('title')}
      </h2>
      <p className="type-body-s text-fg-strong">{t('text')}</p>
      <SourceLine source={source} />
    </section>
  );
}

export type LinkGroup = { title: string; links: { href: string; label: string }[] };

/** "Continue pesquisando": internal links, grouped. Empty groups are dropped. */
export async function ContinueLinks({ groups }: { groups: LinkGroup[] }) {
  const t = await getTranslations('market');
  const visible = groups.filter((g) => g.links.length);
  if (!visible.length) return null;
  return (
    <nav aria-labelledby="continue" className="flex flex-col gap-4 border-t border-line pt-8">
      <h2 id="continue" className="type-title">
        {t('continue')}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <h3 className="type-eyebrow">{group.title}</h3>
            <ul className="flex flex-col gap-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`${linkClass} inline-flex min-h-11 items-center type-body-s`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
