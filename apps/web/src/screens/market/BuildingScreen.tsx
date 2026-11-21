import {
  BuildingFactsRow,
  BuildingTable,
  EmptyState,
  FunnelBars,
  OwnerCTA,
  SalesPerYearBars,
  StatTile,
} from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

import { SITE_URL } from '@/config/site';
import type { BuildingPage } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import { formatChange, formatPriceM2 } from '@/lib/market-format';

import { AlertForm } from './AlertForm';
import { JsonLd, breadcrumbList, dataset, place } from './MarketJsonLd';
import {
  ContinueLinks,
  MarketBreadcrumbs,
  PriceM2Label,
  SourceLine,
  pageClass,
} from './MarketParts';

/** 03 · /condominio/{cidade}/{bairro}/{predio} (docs/mockups/seo/03-building). */
export async function BuildingScreen({ page }: { page: BuildingPage }) {
  const t = await getTranslations('market.building');
  const tMarket = await getTranslations('market');
  const crumbs = [page.city, page.neighborhood, page.street, page.building];
  const name = page.building.name;
  const inName = page.neighborhood.in_name ?? page.neighborhood.name;
  const number = page.street_number.toLocaleString('pt-BR');
  const address = `${page.street.name}, ${number}`;
  const stats = page.stats;
  const priced = Boolean(stats?.priced);
  const city = page.city.slug;
  const neighborhood = page.neighborhood.slug;
  const comparison = page.comparison;
  const valuationHref = `/quanto-vale-meu-imovel/${city}/${neighborhood}?predio=${page.building.slug}`;

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          place({
            name,
            path: page.building.path,
            locality: page.city.name,
            street: address,
            containedIn: page.neighborhood.name,
          }),
          ...(priced
            ? [
                dataset({
                  name: t('datasetName', { name }),
                  description: t('datasetDescription', { name, address }),
                  path: page.building.path,
                  place: `${address}, ${page.neighborhood.name}, ${page.city.name}`,
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
        <h1 className="max-w-[32ch] type-display-l">
          {t('title', { name, address, neighborhood: page.neighborhood.name })}
        </h1>
        <BuildingFactsRow
          label={t('facts.label')}
          facts={[
            page.construction_year
              ? { key: 'year', text: t('facts.year', { year: page.construction_year }) }
              : null,
          ]}
        />
        <p className="max-w-[65ch] type-body text-fg-strong" data-testid="lead">
          {priced && stats?.median_value_cents != null
            ? t('lead', { sales: page.sales, value: formatBRL(stats.median_value_cents) })
            : page.sales > 0
              ? t('leadFew', { sales: page.sales })
              : t('leadNone')}
        </p>
      </header>

      {page.gate.passes && stats ? (
        <section aria-labelledby="vendas" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="vendas" className="type-title">
              {t('sales.question')}
            </h2>
            <p className="type-body-s text-fg-muted">{t('sales.privacy')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={t('sales.count')}
              value={String(page.sales)}
              caption={t('sales.since')}
            />
            <StatTile
              highlighted
              label={t('sales.median')}
              value={stats.median_value_cents != null ? formatBRL(stats.median_value_cents) : '—'}
              caption={priced ? t('sales.allSince') : tMarket('fewSalesExplained', { min: 10 })}
            />
            <StatTile
              label={<PriceM2Label />}
              value={
                stats.median_price_m2_cents != null
                  ? formatPriceM2(stats.median_price_m2_cents)
                  : '—'
              }
              caption={
                comparison?.vs_neighborhood_pct != null
                  ? t('sales.vsNeighborhood', {
                      change: formatChange(comparison.vs_neighborhood_pct),
                      neighborhood: page.neighborhood.name,
                    })
                  : undefined
              }
            />
            {stats.financed_pct != null ? (
              <StatTile
                label={t('sales.financed')}
                value={`${stats.financed_pct}%`}
                caption={t('sales.financedCaption')}
              />
            ) : null}
          </div>
          <SalesPerYearBars
            title={t('sales.perYear')}
            bars={page.sales_by_year.map((y) => ({
              year: String(y.year),
              count: y.sales,
              partial: Boolean(y.partial_until),
            }))}
            formatCount={(n) => n.toLocaleString('pt-BR')}
            partialNote={
              page.sales_by_year.some((y) => y.partial_until)
                ? t('sales.partial', {
                    year: page.sales_by_year[page.sales_by_year.length - 1]?.year ?? '',
                  })
                : undefined
            }
          />
          {comparison ? (
            <div className="flex flex-col gap-2">
              <h3 className="type-body font-semibold">{t('comparison.title', { inName })}</h3>
              <FunnelBars
                label={t('comparison.title', { inName })}
                items={[
                  {
                    key: 'building',
                    label: t('comparison.building'),
                    value: comparison.building_price_m2_cents ?? 0,
                  },
                  ...(comparison.street_price_m2_cents != null
                    ? [
                        {
                          key: 'street',
                          label: page.street.name,
                          value: comparison.street_price_m2_cents,
                        },
                      ]
                    : []),
                  ...(comparison.neighborhood_price_m2_cents != null
                    ? [
                        {
                          key: 'neighborhood',
                          label: page.neighborhood.name,
                          value: comparison.neighborhood_price_m2_cents,
                        },
                      ]
                    : []),
                ].map((item) => ({ ...item, display: formatPriceM2(item.value) }))}
              />
              {comparison.vs_neighborhood_pct != null ? (
                <p className="type-body-s">
                  {t('comparison.sentence', {
                    // The sentence says above/below; the number is unsigned.
                    change: formatChange(Math.abs(Number(comparison.vs_neighborhood_pct))).replace(
                      '+',
                      '',
                    ),
                    direction: Number(comparison.vs_neighborhood_pct) >= 0 ? 'above' : 'below',
                    inName,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
          <SourceLine source={page.source} />
        </section>
      ) : (
        <section aria-labelledby="vendas" className="flex flex-col gap-3">
          <h2 id="vendas" className="type-title">
            {t('sales.question')}
          </h2>
          <p className="type-body">
            {t('sales.fewText', { sales: page.sales, min: 10 })}
            {page.street_stats?.median_value_cents != null
              ? ` ${t('sales.streetFallback', {
                  street: page.street.name,
                  value: formatBRL(page.street_stats.median_value_cents),
                  sales: page.street_stats.sales,
                })}`
              : ''}
          </p>
          <SourceLine source={page.source} />
        </section>
      )}

      <section aria-labelledby="anuncios" className="flex flex-col gap-4">
        <h2 id="anuncios" className="type-title">
          {t('listings.title')}
        </h2>
        {/* Only our authorized listings with CRECI; none exist yet, so: empty state + alert. */}
        <EmptyState title={t('listings.emptyTitle')} description={t('listings.emptyDescription')} />
        <div className="max-w-xl">
          <AlertForm
            variant="building"
            intents={['buy', 'rent']}
            target={{ scope: 'building', city, neighborhood, building: page.building.slug }}
          />
        </div>
      </section>

      <OwnerCTA
        title={t('owner.title')}
        description={t('owner.description')}
        actions={[
          { key: 'valuation', label: t('owner.valuation'), href: valuationHref },
          { key: 'sell', label: t('owner.sell'), href: `${valuationHref}#avaliacao-corretor` },
        ]}
      />

      {page.other_buildings.length ? (
        <section aria-labelledby="outros" className="flex flex-col gap-3">
          <h2 id="outros" className="type-title">
            {t('others.title', { street: page.street.name })}
          </h2>
          <BuildingTable
            caption={t('others.caption', { street: page.street.name })}
            labels={{
              building: t('others.building'),
              year: t('others.year'),
              floors: t('others.floors'),
              units: t('others.units'),
              sales: t('others.sales'),
            }}
            rows={page.other_buildings.map((b) => ({
              key: b.place.slug,
              name: b.place.name,
              href: b.place.path,
              year: b.construction_year ? String(b.construction_year) : undefined,
              sales: b.stats ? String(b.stats.sales) : undefined,
            }))}
            footer={
              <a
                href={page.street.path}
                className="font-semibold text-action underline-offset-4 hover:underline"
              >
                {t('others.seeStreet', { street: page.street.name })} →
              </a>
            }
          />
        </section>
      ) : null}

      <ContinueLinks
        groups={[
          {
            title: t('continue.street'),
            links: [{ href: page.street.path, label: page.street.name }],
          },
          {
            title: page.neighborhood.name,
            links: [
              { href: page.neighborhood.path, label: t('continue.neighborhoodPrice', { inName }) },
              { href: valuationHref, label: t('continue.valuation', { inName }) },
            ],
          },
          {
            title: t('continue.tools'),
            links: [
              { href: `/itbi/${city}`, label: t('continue.itbi') },
              { href: `/financiamento/${city}/${neighborhood}`, label: t('continue.financing') },
            ],
          },
        ]}
      />
    </div>
  );
}
