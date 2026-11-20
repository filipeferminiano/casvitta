import { DataTable, FunnelBars, MonthlySeriesChart, Panel } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SITE_URL } from '@/config/site';
import type { BuildingRow, NeighborhoodPage, NeighborhoodRow, StreetRow } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import { formatAreaBand, formatMonth, formatPriceM2 } from '@/lib/market-format';

import { AlertForm } from './AlertForm';
import { JsonLd, breadcrumbList, dataset, place } from './MarketJsonLd';
import {
  FewData,
  MarketBreadcrumbs,
  ResaleNote,
  SourceLine,
  StatTiles,
  WindowLabel,
  linkClass,
  pageClass,
} from './MarketParts';

/** /preco-m2/{cidade}/{bairro}. */
export async function NeighborhoodScreen({ page }: { page: NeighborhoodPage }) {
  const t = await getTranslations('market.neighborhood');
  const tMarket = await getTranslations('market');
  const crumbs = [page.city, page.neighborhood];
  const name = page.neighborhood.name;
  const financingPath = `/financiamento/${page.city.slug}/${page.neighborhood.slug}`;

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          place({ name, path: page.neighborhood.path, locality: page.city.name }),
          ...(page.gate.passes
            ? [
                dataset({
                  name: t('datasetName', { name }),
                  description: t('datasetDescription', { name }),
                  path: page.neighborhood.path,
                  place: `${name}, ${page.city.name}`,
                  stats: page.stats,
                  source: page.source,
                  creator: tMarket('creator'),
                  license: `${SITE_URL}/termos`,
                }),
              ]
            : []),
        ]}
      />
      <MarketBreadcrumbs items={crumbs} label={tMarket('breadcrumbLabel')} />
      <header className="flex flex-col gap-3">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        <h1 className="type-display-l">{t('title', { name })}</h1>
        <SourceLine
          source={page.source}
          extra={page.stats ? <WindowLabel stats={page.stats} /> : undefined}
        />
      </header>

      {!page.gate.passes || !page.stats ? (
        <FewData gate={page.gate} links={[page.city, ...page.neighbors.map((n) => n.place)]} />
      ) : (
        <>
          <StatTiles stats={page.stats} salesLabel={t('sales12m')} />
          <ResaleNote />
          {page.apartments || page.houses ? (
            <section aria-labelledby="by-kind" className="flex flex-col gap-3">
              <h2 id="by-kind" className="type-title">
                {t('byKind')}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {page.apartments ? (
                  <KindPanel title={t('apartments')} stats={page.apartments} />
                ) : null}
                {page.houses ? <KindPanel title={t('houses')} stats={page.houses} /> : null}
              </div>
            </section>
          ) : null}

          {page.monthly.length ? (
            <MonthlySeriesChart
              points={page.monthly.map((m) => ({
                month: m.month,
                value: m.median_price_m2_cents ?? null,
                count: m.sales,
              }))}
              formatValue={(v) => formatPriceM2(v)}
              formatMonth={formatMonth}
              title={t('chart.title')}
              description={t('chart.description')}
              countLabel={t('chart.count')}
              valueLabel={t('chart.value')}
              monthLabel={t('chart.month')}
            />
          ) : null}

          {page.area_bands.some((b) => b.sales > 0) ? (
            <Panel title={t('bands.title')}>
              <FunnelBars
                label={t('bands.title')}
                caption={t('bands.caption')}
                items={page.area_bands
                  .filter((b) => b.sales > 0)
                  .map((b) => {
                    const band = formatAreaBand(b.min_m2, b.max_m2);
                    return {
                      key: b.band,
                      label: t(`bands.${band.key}`, band.values),
                      value: b.sales,
                      display:
                        b.median_value_cents != null
                          ? t('bands.value', {
                              count: b.sales,
                              value: formatBRL(b.median_value_cents),
                            })
                          : t('bands.count', { count: b.sales }),
                    };
                  })}
              />
            </Panel>
          ) : null}

          {page.years.some((y) => y.stats) ? (
            <DataTable
              caption={t('years.caption', { name })}
              showCaption
              rows={page.years.filter((y) => y.stats)}
              rowKey={(row) => row.year}
              columns={[
                {
                  key: 'year',
                  header: t('years.year'),
                  cell: (row) =>
                    row.partial_until
                      ? t('years.partial', {
                          year: row.year,
                          until: formatMonth(row.partial_until.slice(0, 7)),
                        })
                      : String(row.year),
                },
                {
                  key: 'priceM2',
                  header: t('years.priceM2'),
                  numeric: true,
                  cell: (row) => formatPriceM2(row.stats!.median_price_m2_cents ?? 0),
                },
                {
                  key: 'value',
                  header: t('years.value'),
                  numeric: true,
                  cell: (row) => formatBRL(row.stats!.median_value_cents ?? 0),
                },
                {
                  key: 'sales',
                  header: t('years.sales'),
                  numeric: true,
                  cell: (row) => String(row.stats!.sales),
                },
              ]}
            />
          ) : null}

          <div className="grid gap-8 lg:grid-cols-2">
            <PlaceTable<StreetRow>
              title={t('streets.title')}
              caption={t('streets.caption', { name })}
              rows={page.top_streets}
              nameHeader={t('streets.name')}
              salesHeader={t('streets.sales')}
              empty={t('streets.empty')}
            />
            <PlaceTable<BuildingRow>
              title={t('buildings.title')}
              caption={t('buildings.caption', { name })}
              rows={page.top_buildings}
              nameHeader={t('buildings.name')}
              salesHeader={t('buildings.sales')}
              empty={t('buildings.empty')}
            />
          </div>

          {page.financing ? (
            <Panel title={t('financing.title', { name })}>
              <div className="flex flex-col gap-3 type-body-s">
                <p>
                  {page.financing.median_financed_pct != null
                    ? t('financing.context', {
                        year: page.financing.year,
                        pct: page.financing.financed_pct,
                        share: page.financing.median_financed_pct,
                      })
                    : t('financing.contextNoShare', {
                        year: page.financing.year,
                        pct: page.financing.financed_pct,
                      })}
                </p>
                <Link href={financingPath} className={linkClass}>
                  {t('financing.link')}
                </Link>
              </div>
            </Panel>
          ) : (
            <Link href={financingPath} className={linkClass}>
              {t('financing.link')}
            </Link>
          )}
        </>
      )}

      {page.neighbors.length ? (
        <DataTable<NeighborhoodRow>
          caption={t('neighbors.caption', { name })}
          showCaption
          rows={page.neighbors}
          rowKey={(row) => row.place.slug}
          columns={[
            {
              key: 'name',
              header: t('neighbors.name'),
              cell: (row) => (
                <Link href={row.place.path} className={linkClass}>
                  {row.place.name}
                </Link>
              ),
            },
            {
              key: 'priceM2',
              header: t('neighbors.priceM2'),
              numeric: true,
              cell: (row) =>
                row.stats?.median_price_m2_cents != null
                  ? formatPriceM2(row.stats.median_price_m2_cents)
                  : tMarket('fewDataShort'),
            },
            {
              key: 'sales',
              header: t('neighbors.sales'),
              numeric: true,
              cell: (row) => (row.stats ? String(row.stats.sales) : '—'),
            },
          ]}
        />
      ) : null}

      <section aria-label={tMarket('alert.default.title')} className="max-w-xl">
        <AlertForm
          target={{
            scope: 'neighborhood',
            city: page.city.slug,
            neighborhood: page.neighborhood.slug,
          }}
        />
      </section>
    </div>
  );
}

async function KindPanel({
  title,
  stats,
}: {
  title: string;
  stats: NonNullable<NeighborhoodPage['apartments']>;
}) {
  const t = await getTranslations('market.stats');
  return (
    <Panel title={title}>
      <dl className="grid grid-cols-3 gap-3 type-body-s">
        <div>
          <dt className="text-fg-muted">{t('medianValue')}</dt>
          <dd className="type-value">
            {stats.median_value_cents != null ? formatBRL(stats.median_value_cents) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t('priceM2Short')}</dt>
          <dd className="type-value">
            {stats.median_price_m2_cents != null ? formatPriceM2(stats.median_price_m2_cents) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t('sales')}</dt>
          <dd className="type-value">{stats.sales}</dd>
        </div>
      </dl>
    </Panel>
  );
}

/** Streets or buildings that pass their own gate, linked. */
export async function PlaceTable<Row extends StreetRow | BuildingRow>({
  title,
  caption,
  rows,
  nameHeader,
  salesHeader,
  empty,
}: {
  title: string;
  caption: string;
  rows: Row[];
  nameHeader: string;
  salesHeader: string;
  empty: string;
}) {
  const t = await getTranslations('market.stats');
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-title">{title}</h2>
      <DataTable<Row>
        caption={caption}
        rows={rows}
        rowKey={(row) => row.place.slug}
        empty={<p className="p-4 type-body-s text-fg-muted">{empty}</p>}
        columns={[
          {
            key: 'name',
            header: nameHeader,
            cell: (row) => (
              <Link href={row.place.path} className={linkClass}>
                {row.place.name}
              </Link>
            ),
          },
          {
            key: 'priceM2',
            header: t('priceM2Short'),
            numeric: true,
            cell: (row) =>
              row.stats?.median_price_m2_cents != null
                ? formatPriceM2(row.stats.median_price_m2_cents)
                : '—',
          },
          {
            key: 'sales',
            header: salesHeader,
            numeric: true,
            cell: (row) => (row.stats ? String(row.stats.sales) : '—'),
          },
        ]}
      />
    </section>
  );
}
