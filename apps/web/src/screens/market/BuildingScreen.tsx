import { StatTile } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SITE_URL } from '@/config/site';
import type { BuildingPage } from '@/lib/data/market';

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

/** /condominio/{cidade}/{bairro}/{predio}. */
export async function BuildingScreen({ page }: { page: BuildingPage }) {
  const t = await getTranslations('market.building');
  const tMarket = await getTranslations('market');
  const crumbs = [page.city, page.neighborhood, page.street, page.building];
  const name = page.building.name;
  const address = `${page.street.name}, ${page.street_number}`;
  const stats = page.stats;
  const area =
    stats?.p25_built_area_m2 != null && stats.p75_built_area_m2 != null
      ? t('areaRange', { low: stats.p25_built_area_m2, high: stats.p75_built_area_m2 })
      : null;

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
          ...(page.gate.passes
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
      <MarketBreadcrumbs items={crumbs} label={tMarket('breadcrumbLabel')} />
      <header className="flex flex-col gap-3">
        <p className="type-eyebrow">
          {t('eyebrow', { address, neighborhood: page.neighborhood.name })}
        </p>
        <h1 className="type-display-l">{name}</h1>
        <SourceLine
          source={page.source}
          extra={stats ? <WindowLabel stats={stats} /> : undefined}
        />
      </header>

      {!page.gate.passes || !stats ? (
        <FewData gate={page.gate} links={[page.street, page.neighborhood]} />
      ) : (
        <>
          <StatTiles
            stats={stats}
            salesLabel={t('sales')}
            extra={
              <>
                {area ? <StatTile label={t('areaLabel')} value={area} /> : null}
                {page.construction_year ? (
                  <StatTile label={t('builtIn')} value={String(page.construction_year)} />
                ) : null}
              </>
            }
          />
          <ResaleNote />
        </>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label={tMarket('alert.owner.title')}>
          <AlertForm
            variant="owner"
            defaultIntent="owner"
            showIntent={false}
            target={{
              scope: 'building',
              city: page.city.slug,
              neighborhood: page.neighborhood.slug,
              building: page.building.slug,
            }}
          />
        </section>
        <section aria-label={tMarket('alert.building.title')}>
          <AlertForm
            variant="building"
            defaultIntent="buy"
            showIntent={false}
            target={{
              scope: 'building',
              city: page.city.slug,
              neighborhood: page.neighborhood.slug,
              building: page.building.slug,
            }}
          />
        </section>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 type-body-s">
        <Link href={page.street.path} className={linkClass}>
          {t('backToStreet', { name: page.street.name })}
        </Link>
        <Link href={page.neighborhood.path} className={linkClass}>
          {t('backToNeighborhood', { name: page.neighborhood.name })}
        </Link>
        <Link
          href={`/financiamento/${page.city.slug}/${page.neighborhood.slug}`}
          className={linkClass}
        >
          {tMarket('financingLink', { name: page.neighborhood.name })}
        </Link>
      </div>
    </div>
  );
}
