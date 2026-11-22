import { CheckList, cn, type ComparisonRow, type ComparisonValue } from '@casvitta/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  CATALOG,
  PLANS,
  hasFeature,
  limitOf,
  planOf,
  type CatalogPlan,
  type Feature,
  type Meter,
  type PlanKey,
} from '@/config/catalog';
import { formatBRL } from '@/lib/format';

import { linkButtonClass } from './shared';

/**
 * Plan pieces shared by /para-corretores, /precos and /para-imobiliarias. Every number comes from
 * the catalog (CRM-0); the messages only carry words. No annual toggle while
 * CATALOG.show_annual_prices is off, and no promotion or discount wording anywhere.
 */

const nf = new Intl.NumberFormat('pt-BR');
/** "1.000", "15.000". */
export const formatCount = (n: number) => nf.format(n);

export const signupHref = (key: PlanKey) => `/cadastro/conta?plano=${key}`;
export const AGENCY_DEMO_HREF = '/para-imobiliarias#demonstracao';
export const planAnchor = (key: PlanKey) => `plano-${key}`;

export const planKey = (plan: CatalogPlan) => plan.key as PlanKey;
export const planPrice = (plan: CatalogPlan) => formatBRL(plan.monthly_cents);
export const cheapestPaid = () => PLANS.filter((p) => p.monthly_cents > 0)[0]!;

const sortedPackages = <T extends { days: number; price_cents: number }>(packs: T[]) =>
  [...packs].sort((a, b) => a.days - b.days);

/** "R$ 39 por 7 dias ou R$ 119 por 30 dias" values, from the catalog packages. */
export function packageValues(packs: { days: number; price_cents: number }[]) {
  const sorted = sortedPackages(packs);
  const short = sorted[0]!;
  const long = sorted[sorted.length - 1]!;
  return {
    short: formatBRL(short.price_cents),
    shortDays: short.days,
    long: formatBRL(long.price_cents),
    longDays: long.days,
  };
}

export function usePlanName() {
  const t = useTranslations('plans.names');
  return (key: PlanKey) => t(key);
}

/** "Grátis com 5 imóveis · Essencial R$ 49 · … · Imobiliária a partir de R$ 499". */
export function usePlanLadder() {
  const t = useTranslations('audience.plans');
  const name = usePlanName();
  return () =>
    t('ladder', {
      count: limitOf('free', 'active_properties') ?? 0,
      list: PLANS.filter((p) => p.monthly_cents > 0)
        .map((p) =>
          t(p.price_from ? 'ladderItemFrom' : 'ladderItem', {
            plan: name(planKey(p)),
            price: planPrice(p),
          }),
        )
        .join(' · '),
    });
}

/** What each card lists on top of the plan before it ("Tudo do Essencial, mais:"). */
export function usePlanItemsFor() {
  const t = useTranslations('audience.plans.items');
  const n = (key: PlanKey, meter: Meter) => formatCount(limitOf(key, meter) ?? 0);
  const count = (key: PlanKey, meter: Meter) => limitOf(key, meter) ?? 0;
  return (key: PlanKey): string[] => {
    switch (key) {
      case 'free':
        return [
          t('page'),
          t('freeProperties', { count: n(key, 'active_properties') }),
          t('whatsappButton'),
          t('contactsUpTo', { count: n(key, 'crm_contacts') }),
          t('users', { count: count(key, 'users') }),
        ];
      case 'essential':
        return [
          t('activeProperties', { count: n(key, 'active_properties') }),
          t('contactsUpToShort', { count: n(key, 'crm_contacts') }),
          t('pipeline'),
          t('forms'),
          t('instagramInbox'),
          t('unbranded'),
        ];
      case 'automation':
        return [
          t('activeProperties', { count: n(key, 'active_properties') }),
          t('whatsappConnected'),
          t('commentToDm'),
          t('journeys', { count: count(key, 'journeys') }),
          t('agentLimited', {
            agents: count(key, 'agents'),
            conversations: n(key, 'ai_conversations_month'),
          }),
          t('automationContacts', { count: n(key, 'automation_contacts_month') }),
          t('domainAndCalendar'),
        ];
      case 'pro':
        return [
          t('activeProperties', { count: n(key, 'active_properties') }),
          t('users', { count: count(key, 'users') }),
          t('agentUnlimited', { conversations: n(key, 'ai_conversations_month') }),
          t('journeysUnlimited', { count: n(key, 'automation_contacts_month') }),
          t('reportsBySource'),
          t('includedHighlights', { count: count(key, 'included_highlights_month') }),
        ];
      case 'agency':
        return [
          t('agencyUsers', {
            count: count(key, 'users'),
            price: formatBRL(planOf(key).extra_user_cents ?? 0),
          }),
          t('sharedStock', { count: n(key, 'active_properties') }),
          t('distribution'),
          t('agencyVolumes', {
            conversations: n(key, 'ai_conversations_month'),
            count: n(key, 'automation_contacts_month'),
          }),
          t('pagePerBroker'),
          t('includedHighlights', { count: count(key, 'included_highlights_month') }),
        ];
    }
  };
}

/** The CTA of each plan: signup for broker plans (paid ones are requests), demo for agencies. */
export function PlanAction({
  plan,
  location,
  className,
}: {
  plan: CatalogPlan;
  location: string;
  className?: string;
}) {
  const t = useTranslations('audience.plans');
  const name = usePlanName();
  const key = planKey(plan);
  const recommended = key === 'automation';
  if (key === 'agency') {
    return (
      <Link href={AGENCY_DEMO_HREF} className={cn(linkButtonClass('secondary'), className)}>
        {t('ctaTalk')}
      </Link>
    );
  }
  return (
    <Link
      href={signupHref(key)}
      data-track="select_plan"
      data-track-plan={key}
      data-track-location={location}
      className={cn(linkButtonClass(recommended ? 'primary' : 'secondary'), className)}
    >
      {key === 'free' ? t('ctaFree') : t('ctaChoose', { plan: name(key) })}
    </Link>
  );
}

/** "R$ 149/mês", with "a partir de" above it for the agency plan. */
export function PlanPriceTag({ plan, size = 'l' }: { plan: CatalogPlan; size?: 'm' | 'l' }) {
  const t = useTranslations('audience.plans');
  return (
    <div className="flex flex-col">
      {plan.price_from ? <span className="type-caption">{t('from')}</span> : null}
      <p className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-mono font-semibold tabular',
            size === 'l' ? 'text-[32px] leading-10' : 'text-[22px] leading-7',
          )}
        >
          {planPrice(plan)}
        </span>
        {plan.monthly_cents > 0 ? <span className="type-caption">{t('perMonth')}</span> : null}
      </p>
    </div>
  );
}

/** The five plan cards of /para-corretores (mockup 02-brokers, section "Planos"). */
export function PlanCards({ location }: { location: string }) {
  const t = useTranslations('audience.plans');
  const name = usePlanName();
  const items = usePlanItemsFor();
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((plan, i) => {
          const key = planKey(plan);
          const recommended = key === 'automation';
          const previous = i > 0 ? planKey(PLANS[i - 1]!) : null;
          return (
            <li
              key={key}
              id={planAnchor(key)}
              className={cn(
                'relative flex scroll-mt-24 flex-col gap-4 rounded-card bg-panel p-5',
                recommended ? 'border-2 border-action' : 'border border-line',
              )}
            >
              {recommended ? (
                <span className="absolute -top-3 left-5 rounded-pill bg-action px-2 py-0.5 type-caption font-semibold text-white">
                  {t('recommended')}
                </span>
              ) : null}
              <div>
                <h3 className="type-title">{name(key)}</h3>
                <p className="type-body-s text-fg-muted">{t(`taglines.${key}`)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <PlanPriceTag plan={plan} />
                <p className="type-caption">
                  {plan.monthly_cents > 0 ? t('paidNote') : t('freeNote')}
                </p>
              </div>
              <PlanAction plan={plan} location={location} className="w-full" />
              <div className="flex flex-col gap-2">
                <p className="type-body-s font-semibold">
                  {previous ? t('everythingIn', { plan: name(previous) }) : t('includes')}
                </p>
                <CheckList items={items(key)} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="type-caption">{t('requestNote')}</p>
    </div>
  );
}

/** "O que não está no preço do plano": WhatsApp, Destaques, add-ons and the limit rule. */
export function PlanExtras({ className }: { className?: string }) {
  const t = useTranslations('audience.plans.extras');
  const addOns = CATALOG.add_ons.map((addOn) =>
    t(`addOn.${addOn.key}`, {
      amount: formatCount(addOn.amount),
      price: formatBRL(addOn.price_cents),
    }),
  );
  const columns: [string, ReactNode][] = [
    [t('whatsapp.title'), t('whatsapp.body')],
    [t('highlights.title'), t('highlights.body', packageValues(CATALOG.highlight_packages))],
    [t('addOns.title'), addOns.join(' · ')],
  ];
  return (
    <section
      aria-labelledby="plan-extras-title"
      className={cn(
        'flex flex-col gap-4 rounded-card border border-dashed border-line-dashed p-5 md:p-6',
        className,
      )}
    >
      <h3 id="plan-extras-title" className="type-title">
        {t('title')}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map(([title, body]) => (
          <div key={title} className="flex flex-col gap-1">
            <h4 className="type-body-s font-semibold">{title}</h4>
            <p className="type-body-s text-fg-strong">{body}</p>
          </div>
        ))}
      </div>
      <p className="type-caption">{t('limits')}</p>
    </section>
  );
}

/** How meters are counted (prices page footer). */
export function PlanDefinitions() {
  const t = useTranslations('audience.plans.definitions');
  const owner = packageValues(CATALOG.owner_packages);
  const items = [
    ['activeProperty', t('activeProperty.body')],
    ['aiConversation', t('aiConversation.body')],
    ['automationContact', t('automationContact.body')],
    ['owner', t('owner.body', owner)],
  ] as const;
  return (
    <section aria-labelledby="plan-definitions-title" className="flex flex-col gap-4">
      <h2 id="plan-definitions-title" className="type-title">
        {t('title')}
      </h2>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([key, body]) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="type-body-s font-semibold">{t(`${key}.title`)}</dt>
            <dd className="type-body-s text-fg-strong">{body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Row =
  | { section: string }
  | { feature: Feature }
  | { meter: Meter; unit?: 'm' | 'f'; perMonth?: boolean }
  | { reports: true }
  | { oneOff: true };

/** Rows of the full table (mockup 00-prices-hypotheses), grouped as in the mockup. */
const TABLE: Row[] = [
  { section: 'page' },
  { feature: 'broker_page' },
  { meter: 'active_properties' },
  { feature: 'unbranded_page' },
  { feature: 'custom_domain' },
  { feature: 'page_per_broker' },
  { section: 'crm' },
  { meter: 'users' },
  { meter: 'crm_contacts', unit: 'm' },
  { feature: 'contact_history' },
  { feature: 'pipeline_and_calendar' },
  { feature: 'google_calendar' },
  { feature: 'tracked_forms' },
  { feature: 'segments' },
  { feature: 'distribution_and_permissions' },
  { section: 'channels' },
  { feature: 'whatsapp_button' },
  { feature: 'instagram_inbox' },
  { feature: 'whatsapp_connected' },
  { feature: 'comment_to_dm' },
  { meter: 'journeys', unit: 'f' },
  { meter: 'automation_contacts_month' },
  { section: 'ai' },
  { meter: 'agents', unit: 'm' },
  { meter: 'ai_conversations_month' },
  { feature: 'agent_books_visits' },
  { feature: 'saved_search_alerts' },
  { section: 'reports' },
  { reports: true },
  { meter: 'included_highlights_month', perMonth: true },
  { oneOff: true },
];

/** Rows for PlanComparisonTable: checks, dashes (with a screen-reader "Não incluído") or limits. */
export function usePlanComparisonRows(): ComparisonRow[] {
  const t = useTranslations('audience.plans.table');
  const none: ComparisonValue = (
    <>
      <span aria-hidden="true" className="text-ink-300">
        —
      </span>
      <span className="sr-only">{t('notIncluded')}</span>
    </>
  );
  const keys = PLANS.map(planKey);
  return TABLE.map((row): ComparisonRow => {
    if ('section' in row) return { key: `s-${row.section}`, section: t(`sections.${row.section}`) };
    if ('feature' in row)
      return {
        key: row.feature,
        label: t(`rows.${row.feature}`),
        values: keys.map((k) => (hasFeature(k, row.feature) ? true : none)),
      };
    if ('reports' in row)
      return {
        key: 'reports',
        label: t('rows.reports'),
        values: keys.map((k) => t(`reports.${planOf(k).reports}`)),
      };
    if ('oneOff' in row)
      return {
        key: 'highlights_one_off',
        label: t('rows.highlights_one_off', packageValues(CATALOG.highlight_packages)),
        values: keys.map((k) => (hasFeature(k, 'highlights_one_off') ? true : none)),
      };
    return {
      key: row.meter,
      label: t(`rows.${row.meter}`),
      values: keys.map((k) => {
        const limit = limitOf(k, row.meter);
        if (limit === null) return t(row.unit === 'f' ? 'unlimitedF' : 'unlimited');
        if (limit === 0) return none;
        const extra = planOf(k).extra_user_cents;
        if (row.meter === 'users' && extra)
          return t('usersExtra', { count: formatCount(limit), price: formatBRL(extra) });
        return row.perMonth
          ? t('perMonthCount', { count: formatCount(limit) })
          : formatCount(limit);
      }),
    };
  });
}
