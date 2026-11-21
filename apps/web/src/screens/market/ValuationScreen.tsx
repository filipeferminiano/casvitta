import { MonthlySeriesChart, StatTile } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

import type { NeighborhoodPage, PlaceRef, SourceInfo } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import { formatChange, formatMonth, formatPriceM2 } from '@/lib/market-format';

import { JsonLd, breadcrumbList, webApplication } from './MarketJsonLd';
import {
  ContinueLinks,
  MarketBreadcrumbs,
  PriceM2Label,
  SourceLine,
  pageClass,
} from './MarketParts';
import { ValuationTool } from './ValuationTool';

export type ValuationPrefill = {
  neighborhood: string;
  street: string;
  number: number | null;
  label: string;
} | null;

/** 01 · /quanto-vale-meu-imovel[/{cidade}/{bairro}] (docs/mockups/seo/01-valuation). */
export async function ValuationScreen({
  city,
  neighborhood,
  source,
  prefill,
}: {
  city: PlaceRef;
  neighborhood: NeighborhoodPage | null;
  source: SourceInfo | null;
  prefill: ValuationPrefill;
}) {
  const t = await getTranslations('market.valuation');
  const tMarket = await getTranslations('market');
  const inName = neighborhood?.neighborhood.in_name ?? null;
  const stats = neighborhood?.stats?.priced ? neighborhood.stats : null;
  const selfPath = neighborhood
    ? `/quanto-vale-meu-imovel/${city.slug}/${neighborhood.neighborhood.slug}`
    : '/quanto-vale-meu-imovel';
  const crumbs: PlaceRef[] = [
    { slug: city.slug, name: city.name, path: `/preco-m2/${city.slug}` },
    ...(neighborhood ? [neighborhood.neighborhood] : []),
    { slug: 'quanto-vale', name: t('crumb'), path: selfPath },
  ];
  const title = inName ? t('titleNeighborhood', { inName }) : t('titleCity', { city: city.name });

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          webApplication({ name: t('appName'), path: selfPath, description: t('appDescription') }),
        ]}
      />
      <MarketBreadcrumbs
        items={crumbs}
        label={tMarket('breadcrumbLabel')}
        demo={Boolean(source?.is_demo)}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <header className="flex flex-col gap-3">
          <p className="type-eyebrow">{t('eyebrow')}</p>
          <h1 className="type-display-l">{title}</h1>
          <p className="max-w-[60ch] type-body text-fg-strong" data-testid="lead">
            {stats && inName
              ? t('leadNeighborhood', { sales: stats.sales.toLocaleString('pt-BR'), inName })
              : t('leadCity')}
          </p>
          <ul className="list-disc pl-5 type-body-s text-fg-strong">
            {(['paid', 'groups', 'free'] as const).map((k) => (
              <li key={k}>{t(`bullets.${k}`)}</li>
            ))}
          </ul>
        </header>
        <ValuationTool city={city.slug} initial={prefill} />
      </div>

      {neighborhood && stats && inName ? (
        <section aria-labelledby="contexto" className="flex flex-col gap-4">
          <h2 id="contexto" className="type-title">
            {t('context.question', { inName })}
          </h2>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={t('context.median')}
              value={stats.median_value_cents != null ? formatBRL(stats.median_value_cents) : '—'}
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
                  ? t('context.change', {
                      change: formatChange(stats.median_price_m2_change_12m_pct),
                    })
                  : undefined
              }
            />
            <StatTile label={t('context.sales')} value={stats.sales.toLocaleString('pt-BR')} />
            {stats.financed_pct != null ? (
              <StatTile label={t('context.financed')} value={`${stats.financed_pct}%`} />
            ) : null}
          </div>
          <MonthlySeriesChart
            points={neighborhood.monthly.map((m) => ({
              month: m.month,
              value: m.rolling_median_price_m2_cents ?? null,
              count: m.sales,
            }))}
            formatValue={(v) => formatPriceM2(v)}
            formatMonth={formatMonth}
            title={t('context.chart')}
            valueKind={t('context.valueKind')}
            countLabel={t('context.count')}
            valueLabel={t('context.value')}
            monthLabel={t('context.month')}
            compactAxis
          />
          {source ? <SourceLine source={source} /> : null}
        </section>
      ) : null}

      <section aria-labelledby="como" className="flex max-w-[65ch] flex-col gap-3">
        <h2 id="como" className="type-title">
          {t('how.title')}
        </h2>
        <ol className="list-decimal pl-5 type-body">
          {(['one', 'two', 'three'] as const).map((k) => (
            <li key={k} className="py-1">
              {t(`how.${k}`)}
            </li>
          ))}
        </ol>
        <h2 className="type-title">{t('why.title')}</h2>
        <p className="type-body">{t('why.text')}</p>
        <p className="type-caption">{t('disclaimer')}</p>
      </section>

      <ContinueLinks
        groups={[
          {
            title: t('continue.neighbors'),
            links: (neighborhood?.neighbors ?? []).map((n) => ({
              href: `/quanto-vale-meu-imovel/${city.slug}/${n.place.slug}`,
              label: t('continue.neighborValuation', { inName: n.place.in_name ?? n.place.name }),
            })),
          },
          {
            title: t('continue.prices'),
            links: [
              ...(neighborhood
                ? [
                    {
                      href: neighborhood.neighborhood.path,
                      label: t('continue.neighborhoodPrice', { inName: inName ?? '' }),
                    },
                  ]
                : []),
              { href: `/preco-m2/${city.slug}`, label: t('continue.cityIndex') },
            ],
          },
          {
            title: t('continue.tools'),
            links: [{ href: `/itbi/${city.slug}`, label: t('continue.itbi') }],
          },
        ]}
      />
    </div>
  );
}
