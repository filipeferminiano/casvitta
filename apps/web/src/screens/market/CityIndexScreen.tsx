import { DataTable } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { CityIndexPage, NeighborhoodRow } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import { formatPriceM2 } from '@/lib/market-format';

import { MarketBreadcrumbs, ResaleNote, SourceLine, linkClass, pageClass } from './MarketParts';
import { JsonLd, breadcrumbList } from './MarketJsonLd';

/** /preco-m2/{cidade}: every neighborhood with numbers, plus curated ones without. */
export async function CityIndexScreen({ page }: { page: CityIndexPage }) {
  const t = await getTranslations('market.city');
  const tMarket = await getTranslations('market');
  const withNumbers = page.neighborhoods.filter((n) => n.stats);
  const rows = [...withNumbers, ...page.neighborhoods.filter((n) => !n.stats)];

  return (
    <div className={pageClass}>
      <JsonLd data={breadcrumbList([page.city])} />
      <MarketBreadcrumbs items={[page.city]} label={tMarket('breadcrumbLabel')} />
      <header className="flex flex-col gap-3">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        <h1 className="type-display-l">{t('title', { city: page.city.name })}</h1>
        <p className="max-w-[62ch] type-body text-fg-strong">{t('subtitle')}</p>
        <SourceLine source={page.source} />
      </header>
      <ResaleNote />
      <DataTable<NeighborhoodRow>
        caption={t('tableCaption', { city: page.city.name })}
        rows={rows}
        rowKey={(row) => row.place.slug}
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
                : t('fewData'),
          },
          {
            key: 'value',
            header: t('medianValue'),
            numeric: true,
            cell: (row) =>
              row.stats?.median_value_cents != null ? formatBRL(row.stats.median_value_cents) : '—',
          },
          {
            key: 'sales',
            header: t('sales'),
            numeric: true,
            cell: (row) => (row.stats ? String(row.stats.sales) : '—'),
          },
        ]}
      />
    </div>
  );
}
