import {
  Breadcrumbs,
  Callout,
  EmptyState,
  SourceNote,
  StatTile,
  Tooltip,
  type BreadcrumbItem,
} from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { DemoBadge } from '@/components/badges';
import type { GateInfo, PlaceRef, PublicStats, SourceInfo } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import {
  formatMonth,
  formatPct,
  formatPriceM2,
  formatUpdated,
  formatWindowMonth,
} from '@/lib/market-format';

export const pageClass = 'mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-6 pb-14 md:px-8 md:pt-10';

export function MarketBreadcrumbs({ items, label }: { items: PlaceRef[]; label: string }) {
  const crumbs: BreadcrumbItem[] = items.map((item, index) => ({
    label: item.name,
    href: index === items.length - 1 ? undefined : item.path,
  }));
  return (
    <Breadcrumbs
      items={crumbs}
      label={label}
      renderLink={(href, children) => <Link href={href}>{children}</Link>}
    />
  );
}

/** "Fonte: Prefeitura de São Paulo — guias de ITBI · Atualizado em dd/MM/yyyy · Demonstrativo". */
export async function SourceLine({ source, extra }: { source: SourceInfo; extra?: ReactNode }) {
  const t = await getTranslations('market');
  const items: ReactNode[] = [];
  if (extra) items.push(extra);
  if (source.is_demo) items.push(<DemoBadge key="demo" />);
  return (
    <SourceNote
      source={t('source')}
      updated={
        source.refreshed_at ? t('updated', { date: formatUpdated(source.refreshed_at) }) : undefined
      }
      items={items}
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

export async function PriceM2Label() {
  const t = await getTranslations('market');
  return (
    <span className="inline-flex items-center gap-1">
      {t('priceM2Label')}
      <Tooltip label={t('priceM2Info')} content={t('priceM2Tooltip')} />
    </span>
  );
}

/** Hero tiles: median price, R$/m² (IPTU), sales, % with financing. */
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
  const range =
    stats.p25_price_m2_cents != null && stats.p75_price_m2_cents != null
      ? t('range', {
          low: formatPriceM2(stats.p25_price_m2_cents),
          high: formatPriceM2(stats.p75_price_m2_cents),
        })
      : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.median_value_cents != null ? (
        <StatTile
          highlighted
          label={t('medianValue')}
          value={formatBRL(stats.median_value_cents)}
          caption={
            stats.median_built_area_m2 != null
              ? t('medianArea', { area: stats.median_built_area_m2 })
              : undefined
          }
        />
      ) : null}
      {stats.median_price_m2_cents != null ? (
        <StatTile
          label={<PriceM2Label />}
          value={formatPriceM2(stats.median_price_m2_cents)}
          caption={range}
        />
      ) : null}
      <StatTile
        label={salesLabel}
        value={String(stats.sales)}
        caption={
          stats.last_sale_month
            ? t('lastSaleMonth', { month: formatMonth(stats.last_sale_month) })
            : stats.last_sale_year
              ? t('lastSaleYear', { year: stats.last_sale_year })
              : undefined
        }
      />
      {stats.financed_pct != null ? (
        <StatTile
          label={t('financed')}
          value={formatPct(stats.financed_pct)}
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

/** Below the gate: no numbers, links to the parent and neighbors (page is noindex,follow). */
export async function FewData({ gate, links }: { gate: GateInfo; links: PlaceRef[] }) {
  const t = await getTranslations('market.fewData');
  return (
    <EmptyState
      title={t('title')}
      description={t('description', {
        min: gate.min_sales,
        window: t(`windows.${gate.window as 'last_12m' | 'last_24m' | 'all'}`),
      })}
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
  );
}

export async function ResaleNote() {
  const t = await getTranslations('market');
  return <Callout>{t('resaleOnly')}</Callout>;
}

export const linkClass =
  'font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
