import { Callout } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { FinancingPage } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';

import { FinancingCalculator } from './FinancingCalculator';
import { JsonLd, breadcrumbList } from './MarketJsonLd';
import { FewData, MarketBreadcrumbs, SourceLine, linkClass, pageClass } from './MarketParts';

/** /financiamento/{cidade}/{bairro}: "quanto preciso ganhar". Always a simulation (rule 5). */
export async function FinancingScreen({ page }: { page: FinancingPage }) {
  const t = await getTranslations('market.financing');
  const tMarket = await getTranslations('market');
  const tTypes = await getTranslations('market.financingTypes');
  const name = page.neighborhood.name;
  const self = {
    slug: page.neighborhood.slug,
    name: t('crumb'),
    path: `/financiamento/${page.city.slug}/${page.neighborhood.slug}`,
  };
  const crumbs = [page.city, page.neighborhood, self];
  const sac = page.simulations.find((s) => s.system === 'sac');
  const context = page.financing;
  const knownType =
    context?.top_financing_type_code != null &&
    ['1', '2', '3', '99'].includes(String(context.top_financing_type_code));

  return (
    <div className={pageClass}>
      <JsonLd data={breadcrumbList(crumbs)} />
      <MarketBreadcrumbs items={crumbs} label={tMarket('breadcrumbLabel')} />
      <header className="flex flex-col gap-3">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        <h1 className="type-display-l">{t('title', { name })}</h1>
        {page.median_value_cents != null && sac ? (
          <p className="max-w-[62ch] type-body text-fg-strong" data-testid="financing-summary">
            {t(page.property_kind === 'apartment' ? 'summaryApartment' : 'summaryAll', {
              value: formatBRL(page.median_value_cents),
              income: formatBRL(sac.min_income_cents),
              pct: page.max_income_commitment_pct,
            })}
          </p>
        ) : null}
        <SourceLine source={page.source} />
      </header>

      {!page.gate.passes || page.median_value_cents == null ? (
        <FewData gate={page.gate} links={[page.neighborhood]} />
      ) : (
        <>
          <FinancingCalculator
            neighborhood={name}
            defaults={{
              priceCents: page.median_value_cents,
              downPaymentPct: page.down_payment_pct,
              termMonths: page.term_months,
              annualRateBps: page.annual_rate_bps,
              maxIncomePct: page.max_income_commitment_pct,
            }}
          />
          {context ? (
            <Callout title={t('contextTitle')}>
              {context.median_financed_pct != null
                ? t('context', {
                    year: context.year,
                    pct: context.financed_pct,
                    share: context.median_financed_pct,
                  })
                : t('contextNoShare', { year: context.year, pct: context.financed_pct })}
              {knownType
                ? ` ${t('topType', {
                    type: tTypes(String(context.top_financing_type_code) as '1'),
                  })}`
                : null}
            </Callout>
          ) : null}
          <ul className="list-disc pl-5 type-body-s text-fg-strong">
            <li>{t('notes.simulation')}</li>
            <li>{t('notes.fees')}</li>
            <li>{t('notes.median')}</li>
          </ul>
        </>
      )}

      <Link href={page.neighborhood.path} className={`${linkClass} type-body-s`}>
        {t('backToPrices', { name })}
      </Link>
    </div>
  );
}
