import {
  ListingDataStrip,
  OwnerCTA,
  PropertyCard,
  ResultsHeader,
  StatTile,
  ZeroResultsAlert,
} from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

import { CreciBadge, SponsoredBadge } from '@/components/badges';
import type { NeighborhoodPage, PlaceRef, StreetPage } from '@/lib/data/market';
import type { PublicListingCard } from '@/lib/data/listings';
import { formatBRL } from '@/lib/format';
import { formatPriceM2 } from '@/lib/market-format';

import { AlertForm } from './AlertForm';
import { JsonLd, breadcrumbList } from './MarketJsonLd';
import {
  ContinueLinks,
  MarketBreadcrumbs,
  PriceM2Label,
  SourceLine,
  pageClass,
} from './MarketParts';

export type Transaction = 'venda' | 'aluguel';

/** 07 · /imoveis/{venda|aluguel}/{cidade}/{bairro}[/{rua}] (docs/mockups/seo/07-listings). */
export async function ListingsScreen({
  transaction,
  neighborhood,
  street,
  listings,
}: {
  transaction: Transaction;
  neighborhood: NeighborhoodPage;
  street: StreetPage | null;
  listings: PublicListingCard[];
}) {
  const t = await getTranslations('market.listings');
  const tMarket = await getTranslations('market');
  const rent = transaction === 'aluguel';
  const city = neighborhood.city.slug;
  const bairro = neighborhood.neighborhood.slug;
  const where = street
    ? t('whereStreet', { street: street.street.name })
    : (neighborhood.neighborhood.in_name ?? neighborhood.neighborhood.name);
  const base = `/imoveis/${transaction}/${city}/${bairro}${street ? `/${street.street.slug}` : ''}`;
  const other = `/imoveis/${rent ? 'venda' : 'aluguel'}/${city}/${bairro}${street ? `/${street.street.slug}` : ''}`;
  const self: PlaceRef = {
    slug: transaction,
    name: t(rent ? 'crumbRent' : 'crumbSale'),
    path: base,
  };
  const crumbs = [
    neighborhood.city,
    neighborhood.neighborhood,
    ...(street ? [street.street] : []),
    self,
  ];
  const stats = street?.stats?.priced
    ? street.stats
    : neighborhood.stats?.priced
      ? neighborhood.stats
      : null;

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          // ItemList only with real listings (none exist yet).
          ...(listings.length
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  itemListElement: listings.map((l, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    url: `/imovel/${l.slug}`,
                    name: l.title,
                  })),
                },
              ]
            : []),
        ]}
      />
      <MarketBreadcrumbs
        items={crumbs}
        label={tMarket('breadcrumbLabel')}
        demo={neighborhood.source.is_demo}
      />
      <header className="flex flex-col gap-3">
        <h1 className="type-display-l">
          {t(rent ? 'titleRent' : 'titleSale', { where })}{' '}
          <span className="align-middle type-body-s font-normal text-fg-muted">
            {t('count', { count: listings.length })}
          </span>
        </h1>
        {stats?.median_value_cents != null ? (
          <p className="max-w-[65ch] type-body text-fg-strong" data-testid="lead">
            {t('leadSalePrice', { value: formatBRL(stats.median_value_cents), where })}
          </p>
        ) : null}
      </header>

      <ResultsHeader count={t('resultsCount', { count: listings.length })} />

      {listings.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings
            .filter((l) => l.creciState && l.creciNumber)
            .map((l) => (
              <li key={l.slug}>
                <PropertyCard
                  title={l.title}
                  price={formatBRL(l.priceCents)}
                  specs={l.specs}
                  badges={l.sponsored ? <SponsoredBadge /> : null}
                  broker={
                    <span className="flex items-center gap-2">
                      {l.brokerName}
                      <CreciBadge
                        broker={{ creciState: l.creciState, creciNumber: l.creciNumber }}
                      />
                    </span>
                  }
                />
              </li>
            ))}
        </ul>
      ) : (
        <ZeroResultsAlert
          title={t(rent ? 'zeroRent' : 'zeroSale', { where })}
          description={t('zeroDescription')}
          form={
            <AlertForm
              variant={rent ? 'listingsRent' : 'listingsSale'}
              intents={rent ? ['rent', 'buy'] : ['buy', 'rent']}
              target={
                street
                  ? { scope: 'street', city, neighborhood: bairro, street: street.street.slug }
                  : { scope: 'neighborhood', city, neighborhood: bairro }
              }
            />
          }
          linksLabel={t('zeroLinks')}
          links={[
            ...(street
              ? [
                  {
                    key: 'bairro',
                    label: t('sameInNeighborhood', { name: neighborhood.neighborhood.name }),
                    href: `/imoveis/${transaction}/${city}/${bairro}`,
                  },
                ]
              : []),
            {
              key: 'precos',
              label: t('pricesLink', { where }),
              href: street ? street.street.path : neighborhood.neighborhood.path,
            },
            ...neighborhood.top_streets.slice(0, 3).map((s) => ({
              key: s.place.slug,
              label: s.place.name,
              href: `/imoveis/${transaction}/${city}/${bairro}/${s.place.slug}`,
            })),
          ]}
        />
      )}

      <ListingDataStrip title={t(rent ? 'stripRent' : 'stripSale', { where })}>
        {rent ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(street?.buildings ?? neighborhood.top_buildings).slice(0, 6).map((b) => (
              <li key={b.place.slug}>
                <a
                  href={b.place.path}
                  className="font-semibold text-action underline-offset-4 hover:underline"
                >
                  {b.place.name}
                </a>
                {b.construction_year ? (
                  <span className="type-caption">
                    {' '}
                    · {t('builtIn', { year: b.construction_year })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : stats ? (
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label={t('paidMedian')}
              value={stats.median_value_cents != null ? formatBRL(stats.median_value_cents) : '—'}
            />
            <StatTile
              label={<PriceM2Label />}
              value={
                stats.median_price_m2_cents != null
                  ? formatPriceM2(stats.median_price_m2_cents)
                  : '—'
              }
            />
            <StatTile label={t('paidSales')} value={stats.sales.toLocaleString('pt-BR')} />
          </div>
        ) : (
          <p className="type-body-s">{t('noPrices')}</p>
        )}
        <SourceLine source={neighborhood.source} />
      </ListingDataStrip>

      <OwnerCTA
        title={t('ownerTitle')}
        description={t('ownerDescription')}
        actions={[
          {
            key: 'valuation',
            label: t('ownerAction'),
            href: `/quanto-vale-meu-imovel/${city}/${bairro}`,
          },
        ]}
      />

      <ContinueLinks
        groups={[
          {
            title: t('continue.neighbors'),
            links: neighborhood.neighbors.map((n) => ({
              href: `/imoveis/${transaction}/${city}/${n.place.slug}`,
              label: t(rent ? 'continue.rentIn' : 'continue.saleIn', {
                inName: n.place.in_name ?? n.place.name,
              }),
            })),
          },
          {
            title: t('continue.here'),
            links: [
              {
                href: other,
                label: t(rent ? 'continue.otherSale' : 'continue.otherRent', { where }),
              },
              { href: neighborhood.neighborhood.path, label: t('continue.prices') },
            ],
          },
        ]}
      />
    </div>
  );
}
