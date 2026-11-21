import { Callout, DataTable } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { ItbiNeighborhoodRow, ItbiPage } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';

import { AlertForm } from './AlertForm';
import { ItbiCalculator } from './ItbiCalculator';
import { JsonLd, breadcrumbList, webApplication } from './MarketJsonLd';
import { ContinueLinks, MarketBreadcrumbs, SourceLine, linkClass, pageClass } from './MarketParts';

export const PREFEITURA_ITBI_URL =
  'https://www.prefeitura.sp.gov.br/cidade/secretarias/fazenda/servicos/itbi/';
const QUESTIONS = ['who', 'when', 'base', 'financing', 'guide'] as const;
const pct = (bps: number) =>
  (bps / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * 02 · /itbi/{cidade}. Legal copy is configuration that a person reviews against current law:
 * until rules.reviewed is true the page is noindex, shows "texto a revisar" and has no FAQPage.
 */
export async function ItbiScreen({ page }: { page: ItbiPage }) {
  const t = await getTranslations('market.itbi');
  const tMarket = await getTranslations('market');
  const rules = page.rules;
  const review = rules.reviewed ? undefined : t('review');
  const self = { slug: 'itbi', name: t('crumb'), path: page.city.path };
  const city = { slug: page.city.slug, name: page.city.name, path: `/preco-m2/${page.city.slug}` };
  const crumbs = [city, self];
  const rows = [...(page.city_row ? [page.city_row] : []), ...page.neighborhoods];
  const values = { rate: pct(rules.rate_bps), sfhRate: pct(rules.sfh_rate_bps) };

  return (
    <div className={pageClass}>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          webApplication({
            name: t('appName'),
            path: page.city.path,
            description: t('lead', values),
          }),
          ...(rules.reviewed
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: QUESTIONS.map((q) => ({
                    '@type': 'Question',
                    name: t(`faq.${q}.question`),
                    acceptedAnswer: { '@type': 'Answer', text: t(`faq.${q}.answer`, values) },
                  })),
                },
              ]
            : []),
        ]}
      />
      <MarketBreadcrumbs
        items={crumbs}
        label={tMarket('breadcrumbLabel')}
        demo={page.source.is_demo}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <header className="flex flex-col gap-3">
          <p className="type-eyebrow">{t('eyebrow')}</p>
          <h1 className="type-display-l">{t('title', { city: page.city.name })}</h1>
          <p className="max-w-[60ch] type-body text-fg-strong" data-testid="lead">
            {t('lead', values)}
          </p>
          {review ? <Callout tone="attention">{review}</Callout> : null}
          <ul className="hidden list-disc pl-5 type-body-s text-fg-strong lg:block">
            {(['rate', 'sfh', 'base', 'payer'] as const).map((k) => (
              <li key={k}>{t(`summary.${k}`, values)}</li>
            ))}
          </ul>
          <p className="type-caption">{t('effective', { date: rules.effective_from })}</p>
        </header>
        <ItbiCalculator
          rules={rules}
          reviewMarker={review}
          registry={
            rules.registry_low_cents != null && rules.registry_high_cents != null
              ? { low: rules.registry_low_cents, high: rules.registry_high_cents }
              : null
          }
        />
      </div>

      {rows.length ? (
        <section aria-labelledby="bairros" className="flex flex-col gap-3">
          <h2 id="bairros" className="type-title">
            {t('table.title')}
          </h2>
          <DataTable<ItbiNeighborhoodRow>
            caption={t('table.caption', { city: page.city.name })}
            rows={rows}
            rowKey={(row) => row.place.slug}
            columns={[
              {
                key: 'name',
                header: t('table.neighborhood'),
                cell: (row) =>
                  row === page.city_row ? (
                    <strong>{row.place.name}</strong>
                  ) : (
                    <Link href={row.place.path} className={linkClass}>
                      {row.place.name}
                    </Link>
                  ),
              },
              {
                key: 'value',
                header: t('table.medianValue'),
                numeric: true,
                cell: (row) =>
                  row.median_value_cents != null
                    ? formatBRL(row.median_value_cents)
                    : tMarket('fewSales'),
              },
              {
                key: 'itbi',
                header: t('table.medianItbi'),
                numeric: true,
                cell: (row) =>
                  row.median_itbi_cents != null ? formatBRL(row.median_itbi_cents) : '—',
              },
            ]}
          />
          <p className="type-caption">{t('table.note')}</p>
          <SourceLine source={page.source} />
        </section>
      ) : null}

      <section aria-labelledby="perguntas" className="flex max-w-[65ch] flex-col gap-5">
        <h2 id="perguntas" className="sr-only">
          {t('faq.title')}
        </h2>
        {QUESTIONS.map((q) => (
          <div key={q} className="flex flex-col gap-1">
            <h2 className="type-title">{t(`faq.${q}.question`)}</h2>
            <p className="type-body">{t(`faq.${q}.answer`, values)}</p>
            {review ? <span className="type-caption">{review}</span> : null}
          </div>
        ))}
        <a href={PREFEITURA_ITBI_URL} className={linkClass} rel="noopener">
          {t('official')}
        </a>
      </section>

      <section aria-label={tMarket('alert.itbi.title')} className="max-w-xl">
        <AlertForm
          variant="itbi"
          intents={['buy', 'researching']}
          target={{ scope: 'city', city: page.city.slug }}
        />
      </section>

      <ContinueLinks
        groups={[
          {
            title: t('continue.tools'),
            links: [
              { href: '/quanto-vale-meu-imovel', label: t('continue.valuation') },
              { href: city.path, label: t('continue.cityIndex') },
            ],
          },
        ]}
      />
    </div>
  );
}
