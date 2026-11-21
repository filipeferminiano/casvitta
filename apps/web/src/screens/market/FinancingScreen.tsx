import { NeighborIncomeTable, SalesPerYearBars } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

import { SimulationBadge } from '@/components/badges';
import type { FinancingPage } from '@/lib/data/market';
import { formatBRLShort } from '@/lib/format';
import { formatIncome } from '@/lib/market-format';

import { AlertForm } from './AlertForm';
import { FinancingCalculator } from './FinancingCalculator';
import { JsonLd, breadcrumbList } from './MarketJsonLd';
import { ContinueLinks, FewData, MarketBreadcrumbs, SourceLine, pageClass } from './MarketParts';

/** 05 · /financiamento/{cidade}/{bairro}: "quanto preciso ganhar". Always a simulation (rule 5). */
export async function FinancingScreen({ page }: { page: FinancingPage }) {
  const t = await getTranslations('market.financing');
  const tMarket = await getTranslations('market');
  const name = page.neighborhood.name;
  const inName = page.neighborhood.in_name ?? name;
  const city = page.city.slug;
  const slug = page.neighborhood.slug;
  const self = { slug, name: t('crumb'), path: `/financiamento/${city}/${slug}` };
  const crumbs = [page.city, page.neighborhood, self];
  const sac = page.simulations.find((s) => s.system === 'sac');
  const rate = (page.annual_rate_bps / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const context = page.financing;
  const partial = page.financed_by_year.find((y) => y.partial_until);

  return (
    <div className={pageClass}>
      <JsonLd data={breadcrumbList(crumbs)} />
      <MarketBreadcrumbs
        items={crumbs}
        label={tMarket('breadcrumbLabel')}
        demo={page.source.is_demo}
      />

      {!page.gate.passes || page.median_value_cents == null || !sac ? (
        <>
          <header className="flex flex-col gap-3">
            <p className="type-eyebrow">{t('eyebrow', { name })}</p>
            <h1 className="type-display-l">{t('title', { inName })}</h1>
          </header>
          <FewData gate={page.gate} links={[page.neighborhood]} />
        </>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-3">
              <p className="type-eyebrow">{t('eyebrow', { name })}</p>
              <h1 className="type-display-l">{t('title', { inName })}</h1>
              <p className="max-w-[60ch] type-body text-fg-strong" data-testid="financing-summary">
                {t(page.property_kind === 'apartment' ? 'leadApartment' : 'leadAll', {
                  value: formatBRLShort(page.median_value_cents),
                  down: page.down_payment_pct,
                  years: page.term_months / 12,
                  income: formatIncome(sac.min_income_cents),
                })}
              </p>
              <p className="flex flex-wrap items-center gap-2 type-caption">
                <SimulationBadge />
                {t('leadAssumptions', { rate })}
              </p>
            </header>

            {context ? (
              <section aria-labelledby="quem-financia" className="flex flex-col gap-3">
                <h2 id="quem-financia" className="type-title">
                  {t('who.question', { inName })}
                </h2>
                <p className="type-body">
                  {context.median_financed_pct != null
                    ? t('who.answer', {
                        year: context.year,
                        inName,
                        pct: context.financed_pct,
                        share: context.median_financed_pct,
                      })
                    : t('who.answerNoShare', {
                        year: context.year,
                        inName,
                        pct: context.financed_pct,
                      })}
                </p>
                {page.financed_by_year.length ? (
                  <SalesPerYearBars
                    title={t('who.chart')}
                    bars={page.financed_by_year.map((y) => ({
                      year: String(y.year),
                      count: y.financed_pct,
                      partial: Boolean(y.partial_until),
                    }))}
                    formatCount={(n) => `${n}%`}
                    partialNote={partial ? t('who.partial', { year: partial.year }) : undefined}
                  />
                ) : null}
                <SourceLine source={page.source} />
              </section>
            ) : null}
          </div>

          <section id="simulacao" aria-label={t('calculator.title')} className="scroll-mt-20">
            <FinancingCalculator
              neighborhood={name}
              initial={page.simulations}
              defaults={{
                priceCents: page.median_value_cents,
                downPaymentPct: page.down_payment_pct,
                minDownPaymentPct: page.min_down_payment_pct,
                termMonths: page.term_months,
                annualRateBps: page.annual_rate_bps,
                maxIncomePct: page.max_income_commitment_pct,
              }}
            />
          </section>
        </div>
      )}

      {page.neighbors.length && sac && page.median_value_cents != null ? (
        <section aria-labelledby="vizinhos" className="flex flex-col gap-3">
          <h2 id="vizinhos" className="type-title">
            {t('neighbors.question')}
          </h2>
          <p className="type-body-s text-fg-muted">
            {t('neighbors.assumptions', {
              down: page.down_payment_pct,
              years: page.term_months / 12,
              rate,
            })}
          </p>
          <NeighborIncomeTable
            caption={t('neighbors.caption', { name })}
            badge={<SimulationBadge />}
            labels={{
              neighborhood: t('neighbors.name'),
              medianValue: t('neighbors.medianValue'),
              income: t('neighbors.income'),
              current: t('neighbors.current'),
              fewSales: tMarket('fewSales'),
            }}
            rows={[
              {
                key: slug,
                name,
                current: true,
                medianValue: formatBRLShort(page.median_value_cents),
                income: formatIncome(sac.min_income_cents),
              },
              ...page.neighbors.map((n) => ({
                key: n.place.slug,
                name: n.place.name,
                href: `/financiamento/${city}/${n.place.slug}`,
                medianValue: formatBRLShort(n.median_value_cents),
                income: formatIncome(n.min_income_cents),
              })),
            ]}
          />
        </section>
      ) : null}

      <section aria-label={tMarket('alert.financing.title')} className="max-w-xl">
        <AlertForm
          variant="financing"
          titleValues={{ inName }}
          intents={['buy']}
          budget
          target={{ scope: 'neighborhood', city, neighborhood: slug }}
        />
      </section>

      <ContinueLinks
        groups={[
          {
            title: name,
            links: [
              { href: page.neighborhood.path, label: t('continue.price', { inName }) },
              { href: `/quanto-vale-meu-imovel/${city}/${slug}`, label: t('continue.valuation') },
            ],
          },
          {
            title: t('continue.beforeBuying'),
            links: [
              { href: `/itbi/${city}`, label: t('continue.itbi') },
              ...page.neighbors.map((n) => ({
                href: `/financiamento/${city}/${n.place.slug}`,
                label: t('continue.neighbor', { inName: n.place.in_name ?? n.place.name }),
              })),
            ],
          },
          {
            title: page.city.name,
            links: [{ href: page.city.path, label: t('continue.cityIndex') }],
          },
        ]}
      />
    </div>
  );
}
