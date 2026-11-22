import { PlanComparisonTable } from '@casvitta/ui';
import { useTranslations } from 'next-intl';

import { PAID_PLANS, PLANS } from '@/config/catalog';

import {
  PlanAction,
  PlanDefinitions,
  PlanExtras,
  planKey,
  planPrice,
  usePlanComparisonRows,
  usePlanName,
} from './plans';
import { AudienceBreadcrumb, AudienceJsonLd, CONTAINER } from './shared';

/**
 * Prices page (mockup landing-pages/00-prices-hypotheses): the full feature and limit table from
 * the catalog, what the plan price leaves out, and how each meter is counted. Monthly only while
 * annual prices are off in the catalog.
 */
export function PricesScreen() {
  const t = useTranslations('audience.prices');
  const tTable = useTranslations('audience.plans.table');
  const tPlans = useTranslations('audience.plans');
  const tCommon = useTranslations('audience.common');
  const name = usePlanName();
  const rows = usePlanComparisonRows();

  return (
    <>
      <AudienceJsonLd
        path="/precos"
        homeLabel={tCommon('home')}
        pageLabel={t('meta.breadcrumb')}
        faq={[]}
        offers={PAID_PLANS.map((plan) => ({
          name: t('offerName', { plan: name(planKey(plan)) }),
          priceCents: plan.monthly_cents,
          monthly: true,
        }))}
      />
      <AudienceBreadcrumb page={t('meta.breadcrumb')} />
      <div className={`${CONTAINER} flex flex-col gap-10 pt-4 pb-16 md:pt-6 md:pb-20`}>
        <div className="flex max-w-[44rem] flex-col gap-2">
          <p className="type-eyebrow">{t('eyebrow')}</p>
          <h1 className="type-display-l text-balance">{t('title')}</h1>
          <p className="type-body text-fg-strong">{t('subtitle')}</p>
        </div>
        <PlanComparisonTable
          caption={tTable('caption')}
          featureHeader={tTable('feature')}
          includedLabel={tTable('included')}
          plans={PLANS.map((plan) => ({
            key: plan.key,
            name: name(planKey(plan)),
            price: planPrice(plan),
            period: plan.monthly_cents > 0 ? tPlans('perMonth') : undefined,
            note: plan.price_from ? tPlans('from') : undefined,
            highlighted: plan.key === 'automation',
            action: <PlanAction plan={plan} location="prices_table" className="px-3" />,
          }))}
          rows={rows}
        />
        <p className="type-caption">{tPlans('requestNote')}</p>
        <PlanExtras />
        <PlanDefinitions />
      </div>
    </>
  );
}
