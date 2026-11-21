import { BuildingTable, SalesPerYearBars, StreetQuickLinks } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SITE_URL } from '@/config/site';
import type { StreetPage } from '@/lib/data/market';
import { formatPriceM2 } from '@/lib/market-format';

import { AlertForm } from './AlertForm';
import { JsonLd, breadcrumbList, dataset, place } from './MarketJsonLd';
import {
  ContinueLinks,
  MarketBreadcrumbs,
  SourceLine,
  StatTiles,
  linkClass,
  pageClass,
} from './MarketParts';

export const MAX_SIMILAR_STREETS = 8;

/**
 * 06 · /rua/{cidade}/{bairro}/{rua} (docs/mockups/seo/06-street). Title and H1 carry only the
 * street and neighborhood. Stock, turnover and the long-street parent page need the IPTU
 * register (SEO-2); listings counts need real authorized listings.
 */
export async function StreetScreen({ page }: { page: StreetPage }) {
  const t = await getTranslations('market.street');
  const tMarket = await getTranslations('market');
  const crumbs = [page.city, page.neighborhood, page.street];
  const name = page.street.name;
  const neighborhood = page.neighborhood.name;
  const city = page.city.slug;
  const bairro = page.neighborhood.slug;
  const rua = page.street.slug;
  const last12 = page.last_12m;
  const priced = Boolean(page.stats?.priced);

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          place({
            name: `${name}, ${neighborhood}`,
            path: page.street.path,
            locality: page.city.name,
            street: name,
            containedIn: neighborhood,
          }),
          ...(priced
            ? [
                dataset({
                  name: t('datasetName', { name, neighborhood }),
                  description: t('datasetDescription', { name, neighborhood }),
                  path: page.street.path,
                  place: `${name}, ${neighborhood}, ${page.city.name}`,
                  stats: page.stats,
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
        <p className="type-eyebrow">{t('eyebrow', { neighborhood })}</p>
        <h1 className="type-display-l">{t('title', { name, neighborhood })}</h1>
        <p className="max-w-[65ch] type-body text-fg-strong" data-testid="lead">
          {last12 && last12.sales > 0
            ? t('lead12', { sales: last12.sales, buildings: page.buildings.length })
            : t('lead36', { sales: page.sales_36m })}
        </p>
      </header>

      <StreetQuickLinks
        label={t('quick.label')}
        links={[
          {
            key: 'venda',
            title: t('quick.sale'),
            href: `/imoveis/venda/${city}/${bairro}/${rua}`,
            count: null,
            caption: t('quick.alert'),
          },
          {
            key: 'aluguel',
            title: t('quick.rent'),
            href: `/imoveis/aluguel/${city}/${bairro}/${rua}`,
            count: null,
            caption: t('quick.alert'),
          },
          {
            key: 'valor',
            title: t('quick.valuation'),
            href: `/quanto-vale-meu-imovel/${city}/${bairro}`,
            count: null,
            caption: t('quick.valuationCaption'),
          },
        ]}
      />

      <section aria-labelledby="vendas" className="flex flex-col gap-4">
        <h2 id="vendas" className="type-title">
          {t('sales.question', { name })}
        </h2>
        {page.gate.passes && page.stats ? (
          <>
            <StatTiles stats={page.stats} salesLabel={t('sales.count36')} />
            {page.sales_by_year.length ? (
              <SalesPerYearBars
                title={t('sales.perYear')}
                bars={page.sales_by_year.map((y) => ({
                  year: String(y.year),
                  count: y.sales,
                  partial: Boolean(y.partial_until),
                }))}
                formatCount={(n) => n.toLocaleString('pt-BR')}
              />
            ) : null}
          </>
        ) : (
          <p className="type-body">
            {t('sales.few', { sales: page.sales_36m, min: page.gate.min_sales })}
          </p>
        )}
        <SourceLine source={page.source} />
      </section>

      <section aria-labelledby="predios" className="flex flex-col gap-3">
        <h2 id="predios" className="type-title">
          {t('buildings.title', { name })}
        </h2>
        {page.buildings.length ? (
          <BuildingTable
            caption={t('buildings.caption', { name })}
            labels={{
              building: t('buildings.name'),
              year: t('buildings.year'),
              floors: t('buildings.floors'),
              units: t('buildings.units'),
              sales: t('buildings.sales'),
            }}
            rows={page.buildings.map((b) => ({
              key: b.place.slug,
              name: b.place.name,
              href: b.place.path,
              year: b.construction_year ? String(b.construction_year) : undefined,
              sales: b.stats ? String(b.stats.sales) : undefined,
            }))}
          />
        ) : (
          <p className="type-body-s text-fg-muted">{t('buildings.empty')}</p>
        )}
      </section>

      {page.similar_streets.length ? (
        <section aria-labelledby="parecidas" className="flex flex-col gap-3">
          <h2 id="parecidas" className="type-title">
            {t('similar.title', { neighborhood })}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {page.similar_streets.slice(0, MAX_SIMILAR_STREETS).map((s) => (
              <li
                key={s.place.slug}
                className="flex items-baseline justify-between gap-3 border-b border-line py-2"
              >
                <Link
                  href={s.place.path}
                  className={`${linkClass} min-h-11 inline-flex items-center`}
                >
                  {s.place.name}
                </Link>
                <span className="type-caption">
                  {s.stats?.median_price_m2_cents != null
                    ? formatPriceM2(s.stats.median_price_m2_cents)
                    : s.stats
                      ? t('similar.sales', { sales: s.stats.sales })
                      : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label={tMarket('alert.street.title', { name })} className="max-w-xl">
        <AlertForm
          variant="street"
          titleValues={{ name }}
          intents={['buy', 'rent', 'own_sell']}
          target={{ scope: 'street', city, neighborhood: bairro, street: rua }}
        />
      </section>

      <ContinueLinks
        groups={[
          {
            title: t('continue.street', { name }),
            links: [
              {
                href: `/imoveis/venda/${city}/${bairro}/${rua}`,
                label: t('continue.sale', { name }),
              },
              {
                href: `/imoveis/aluguel/${city}/${bairro}/${rua}`,
                label: t('continue.rent', { name }),
              },
              ...(page.buildings[0]
                ? [{ href: page.buildings[0].place.path, label: page.buildings[0].place.name }]
                : []),
            ],
          },
          {
            title: neighborhood,
            links: [
              {
                href: page.neighborhood.path,
                label: t('continue.neighborhoodPrice', {
                  inName: page.neighborhood.in_name ?? neighborhood,
                }),
              },
              { href: `/quanto-vale-meu-imovel/${city}/${bairro}`, label: t('continue.valuation') },
            ],
          },
          {
            title: t('continue.tools'),
            links: [
              { href: `/financiamento/${city}/${bairro}`, label: t('continue.financing') },
              { href: `/itbi/${city}`, label: t('continue.itbi') },
            ],
          },
        ]}
      />
    </div>
  );
}
