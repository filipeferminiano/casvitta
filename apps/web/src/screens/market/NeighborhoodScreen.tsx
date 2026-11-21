import {
  AreaBandTable,
  DataTable,
  MonthlySeriesChart,
  NeighborComparisonTable,
  StatTile,
} from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SITE_URL } from '@/config/site';
import type { BuildingRow, NeighborhoodPage, StreetRow } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import {
  formatAreaBand,
  formatChange,
  formatMonth,
  formatPriceM2,
  formatWindowMonth,
} from '@/lib/market-format';

import { AlertForm } from './AlertForm';
import { JsonLd, breadcrumbList, dataset, place } from './MarketJsonLd';
import {
  ContinueLinks,
  FewData,
  MarketBreadcrumbs,
  MethodNote,
  PriceM2Label,
  SourceLine,
  linkClass,
  pageClass,
} from './MarketParts';

/** 04 · /preco-m2/{cidade}/{bairro} (docs/mockups/seo/04-neighborhood-price). */
export async function NeighborhoodScreen({ page }: { page: NeighborhoodPage }) {
  const t = await getTranslations('market.neighborhood');
  const tMarket = await getTranslations('market');
  const crumbs = [page.city, page.neighborhood];
  const name = page.neighborhood.name;
  const inName = page.neighborhood.in_name ?? name;
  const stats = page.stats;
  const city = page.city.slug;
  const slug = page.neighborhood.slug;
  const windowEnd = page.source.window_end ? formatWindowMonth(page.source.window_end) : '';
  const year = page.source.window_end?.slice(0, 4) ?? '';
  const priced = Boolean(stats?.priced && stats.median_price_m2_cents != null);

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          place({ name, path: page.neighborhood.path, locality: page.city.name }),
          ...(priced
            ? [
                dataset({
                  name: t('datasetName', { name }),
                  description: t('datasetDescription', { name }),
                  path: page.neighborhood.path,
                  place: `${name}, ${page.city.name}`,
                  stats,
                  source: page.source,
                  creator: tMarket('creator'),
                  license: `${SITE_URL}/termos`,
                }),
              ]
            : []),
        ]}
      />
      <MarketBreadcrumbs
        items={crumbs}
        label={tMarket('breadcrumbLabel')}
        demo={page.source.is_demo}
      />
      <header className="flex flex-col gap-3">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        <h1 className="max-w-[28ch] type-display-l">
          {priced && stats?.median_price_m2_cents != null
            ? t('title', { inName, price: formatPriceM2(stats.median_price_m2_cents), year })
            : t('titleFew', { inName })}
        </h1>
        <p className="max-w-[65ch] type-body text-fg-strong" data-testid="lead">
          {priced && stats?.median_value_cents != null
            ? t(stats.financed_pct != null ? 'lead' : 'leadNoFinancing', {
                sales: stats.sales.toLocaleString('pt-BR'),
                inName,
                value: formatBRL(stats.median_value_cents),
                financed: stats.financed_pct ?? 0,
              })
            : t('leadFew', {
                sales: page.sales_12m.toLocaleString('pt-BR'),
                inName,
                min: page.gate.min_sales,
              })}
        </p>
      </header>

      {!page.gate.passes || !stats ? (
        <FewData
          gate={page.gate}
          sales={page.sales_12m}
          links={[page.city, ...page.neighbors.map((n) => n.place)]}
          neighbors={page.neighbors}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatTile
              highlighted
              label={t('tiles.medianValue')}
              value={stats.median_value_cents != null ? formatBRL(stats.median_value_cents) : '—'}
              caption={t('tiles.window', { end: windowEnd })}
            />
            <StatTile
              label={<PriceM2Label />}
              value={
                stats.median_price_m2_cents != null
                  ? formatPriceM2(stats.median_price_m2_cents)
                  : '—'
              }
              caption={
                stats.median_price_m2_change_12m_pct != null
                  ? t('tiles.change', {
                      change: formatChange(stats.median_price_m2_change_12m_pct),
                    })
                  : undefined
              }
            />
            <StatTile
              label={t('tiles.sales')}
              value={stats.sales.toLocaleString('pt-BR')}
              caption={
                stats.sales_change_12m_pct != null
                  ? t('tiles.change', { change: formatChange(stats.sales_change_12m_pct) })
                  : undefined
              }
            />
            {stats.financed_pct != null ? (
              <StatTile
                label={t('tiles.financed')}
                value={`${stats.financed_pct}%`}
                caption={t('tiles.financedCaption')}
              />
            ) : null}
          </div>

          <SourceLine source={page.source} />

          <section aria-labelledby="trend" className="flex flex-col gap-3">
            <h2 id="trend" className="type-title">
              {t('trend.question', { inName })}
            </h2>
            {stats.median_price_m2_change_12m_pct != null ? (
              <p className="max-w-[65ch] type-body">
                {page.price_m2_change_5y_pct != null
                  ? t('trend.answer', {
                      change12: formatChange(stats.median_price_m2_change_12m_pct),
                      change5: formatChange(page.price_m2_change_5y_pct),
                    })
                  : t('trend.answer12', {
                      change12: formatChange(stats.median_price_m2_change_12m_pct),
                    })}
              </p>
            ) : null}
            <MonthlySeriesChart
              points={page.monthly.map((m) => ({
                month: m.month,
                value: m.rolling_median_price_m2_cents ?? null,
                count: m.sales,
              }))}
              formatValue={(v) => formatPriceM2(v)}
              formatMonth={formatMonth}
              title={t('chart.title')}
              description={t('chart.description')}
              valueKind={t('chart.valueKind')}
              countLabel={t('chart.count')}
              valueLabel={t('chart.value')}
              monthLabel={t('chart.month')}
            />
          </section>

          {page.area_bands.some((b) => b.sales > 0) ? (
            <section aria-labelledby="bands" className="flex flex-col gap-3">
              <h2 id="bands" className="type-title">
                {t('bands.question', { inName })}
              </h2>
              <AreaBandTable
                caption={t('bands.caption')}
                labels={{
                  band: t('bands.band'),
                  sales: t('bands.sales'),
                  median: t('bands.median'),
                  priceM2: t('bands.priceM2'),
                  fewSales: tMarket('fewSales'),
                }}
                rows={page.area_bands
                  .filter((b) => b.sales > 0)
                  .map((b) => {
                    const band = formatAreaBand(b.min_m2, b.max_m2);
                    return {
                      key: b.band,
                      label: t(`bands.${band.key}`, band.values),
                      sales: b.sales.toLocaleString('pt-BR'),
                      medianValue:
                        b.median_value_cents != null ? formatBRL(b.median_value_cents) : null,
                      medianPriceM2:
                        b.median_price_m2_cents != null
                          ? formatPriceM2(b.median_price_m2_cents)
                          : null,
                    };
                  })}
              />
            </section>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-2">
            <StreetTable rows={page.top_streets} inName={inName} />
            <BuildingRowsTable rows={page.top_buildings} inName={inName} />
          </div>
        </>
      )}

      {page.neighbors.length ? (
        <section aria-labelledby="neighbors" className="flex flex-col gap-3">
          <h2 id="neighbors" className="type-title">
            {t('neighbors.question', { name })}
          </h2>
          <NeighborComparisonTable
            caption={t('neighbors.caption', { name })}
            labels={{
              neighborhood: t('neighbors.name'),
              priceM2: t('neighbors.priceM2'),
              change: t('neighbors.change'),
              current: t('neighbors.current'),
              fewSales: tMarket('fewSales'),
            }}
            rows={[
              ...(stats
                ? [
                    {
                      key: slug,
                      name,
                      current: true,
                      priceM2:
                        stats.median_price_m2_cents != null
                          ? formatPriceM2(stats.median_price_m2_cents)
                          : null,
                      change:
                        stats.median_price_m2_change_12m_pct != null
                          ? formatChange(stats.median_price_m2_change_12m_pct)
                          : null,
                    },
                  ]
                : []),
              ...page.neighbors.map((n) => ({
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
              })),
            ]}
          />
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <CtaCard
          href={`/financiamento/${city}/${slug}`}
          title={t('cta.financingTitle')}
          description={t('cta.financingDescription', { inName })}
        />
        <CtaCard
          href={`/quanto-vale-meu-imovel/${city}/${slug}`}
          title={t('cta.valuationTitle')}
          description={t('cta.valuationDescription')}
        />
      </div>

      <section aria-label={tMarket('alert.neighborhood.title', { inName })} className="max-w-xl">
        <AlertForm
          variant="neighborhood"
          titleValues={{ inName }}
          intents={['buy', 'rent', 'own_sell']}
          target={{ scope: 'neighborhood', city, neighborhood: slug }}
        />
      </section>

      <MethodNote source={page.source} />

      <ContinueLinks
        groups={[
          {
            title: t('continue.neighbors'),
            links: page.neighbors.map((n) => ({
              href: n.place.path,
              label: t('continue.neighborPrice', { inName: n.place.in_name ?? n.place.name }),
            })),
          },
          {
            title: t('continue.here', { inName }),
            links: [
              { href: `/financiamento/${city}/${slug}`, label: t('continue.financing') },
              { href: `/quanto-vale-meu-imovel/${city}/${slug}`, label: t('continue.valuation') },
            ],
          },
          {
            title: page.city.name,
            links: [
              { href: page.city.path, label: t('continue.cityIndex') },
              { href: `/itbi/${city}`, label: t('continue.itbi') },
            ],
          },
        ]}
      />
    </div>
  );
}

async function StreetTable({ rows, inName }: { rows: StreetRow[]; inName: string }) {
  const t = await getTranslations('market.neighborhood.streets');
  const tMarket = await getTranslations('market');
  return (
    <section aria-labelledby="ruas" className="flex flex-col gap-3">
      <h2 id="ruas" className="type-title">
        {t('title')}
      </h2>
      <DataTable<StreetRow>
        caption={t('caption', { inName })}
        rows={rows}
        rowKey={(row) => row.place.slug}
        empty={<p className="p-4 type-body-s text-fg-muted">{t('empty')}</p>}
        columns={[
          {
            key: 'name',
            header: t('name'),
            cell: (row) => (
              <Link href={row.place.path} className={linkClass}>
                {row.place.name}
              </Link>
            ),
          },
          {
            key: 'sales',
            header: t('sales'),
            numeric: true,
            cell: (row) => (row.stats ? row.stats.sales.toLocaleString('pt-BR') : '—'),
          },
          {
            key: 'median',
            header: t('median'),
            numeric: true,
            cell: (row) =>
              row.stats?.median_value_cents != null
                ? formatBRL(row.stats.median_value_cents)
                : tMarket('fewSales'),
          },
        ]}
      />
    </section>
  );
}

async function BuildingRowsTable({ rows, inName }: { rows: BuildingRow[]; inName: string }) {
  const t = await getTranslations('market.neighborhood.buildings');
  return (
    <section aria-labelledby="predios" className="flex flex-col gap-3">
      <h2 id="predios" className="type-title">
        {t('title')}
      </h2>
      <DataTable<BuildingRow>
        caption={t('caption', { inName })}
        rows={rows}
        rowKey={(row) => row.place.slug}
        empty={<p className="p-4 type-body-s text-fg-muted">{t('empty')}</p>}
        columns={[
          {
            key: 'name',
            header: t('name'),
            cell: (row) => (
              <Link href={row.place.path} className={linkClass}>
                {row.place.name}
              </Link>
            ),
          },
          {
            key: 'street',
            header: t('street'),
            className: 'hidden md:table-cell',
            cell: (row) => row.street_name,
          },
          {
            key: 'sales',
            header: t('sales'),
            numeric: true,
            cell: (row) => (row.stats ? row.stats.sales.toLocaleString('pt-BR') : '—'),
          },
        ]}
      />
    </section>
  );
}

function CtaCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-col gap-1 rounded-card border border-line bg-panel p-4 hover:border-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="type-body font-semibold text-action">{title} →</span>
      <span className="type-body-s text-fg-muted">{description}</span>
    </Link>
  );
}
