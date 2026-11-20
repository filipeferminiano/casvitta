import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SITE_URL } from '@/config/site';
import type { BuildingRow, StreetPage } from '@/lib/data/market';

import { AlertForm } from './AlertForm';
import { JsonLd, breadcrumbList, dataset } from './MarketJsonLd';
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
import { PlaceTable } from './NeighborhoodScreen';

/** /preco-m2/{cidade}/{bairro}/{rua}. */
export async function StreetScreen({ page }: { page: StreetPage }) {
  const t = await getTranslations('market.street');
  const tMarket = await getTranslations('market');
  const crumbs = [page.city, page.neighborhood, page.street];
  const name = page.street.name;
  const where = `${name}, ${page.neighborhood.name}`;

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          ...(page.gate.passes
            ? [
                dataset({
                  name: t('datasetName', { name: where }),
                  description: t('datasetDescription', { name: where }),
                  path: page.street.path,
                  place: `${where}, ${page.city.name}`,
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
        <p className="type-eyebrow">{t('eyebrow', { neighborhood: page.neighborhood.name })}</p>
        <h1 className="type-display-l">{t('title', { name })}</h1>
        <SourceLine
          source={page.source}
          extra={page.stats ? <WindowLabel stats={page.stats} /> : undefined}
        />
      </header>

      {!page.gate.passes || !page.stats ? (
        <FewData gate={page.gate} links={[page.neighborhood]} />
      ) : (
        <>
          <StatTiles stats={page.stats} salesLabel={t('sales24m')} />
          <ResaleNote />
          <PlaceTable<BuildingRow>
            title={t('buildings.title')}
            caption={t('buildings.caption', { name })}
            rows={page.buildings}
            nameHeader={t('buildings.name')}
            salesHeader={t('buildings.sales')}
            empty={t('buildings.empty')}
          />
        </>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 type-body-s">
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

      <section aria-label={tMarket('alert.default.title')} className="max-w-xl">
        <AlertForm
          target={{
            scope: 'street',
            city: page.city.slug,
            neighborhood: page.neighborhood.slug,
            street: page.street.slug,
          }}
        />
      </section>
    </div>
  );
}
