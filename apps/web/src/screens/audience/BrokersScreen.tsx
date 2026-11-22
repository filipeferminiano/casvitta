import {
  AppPreviewFrame,
  AudienceTag,
  CheckList,
  FeatureCard,
  type AppPreviewNavItem,
  type FaqItem,
} from '@casvitta/ui';
import {
  Bot,
  CalendarDays,
  Contact,
  Filter,
  House,
  Inbox,
  LayoutDashboard,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { PAID_PLANS, PLANS, firstPlanWith, limitOf, type Feature } from '@/config/catalog';
import { formatBRL } from '@/lib/format';

import {
  PlanCards,
  PlanExtras,
  cheapestPaid,
  formatCount,
  planAnchor,
  planKey,
  planPrice,
  signupHref,
  usePlanLadder,
  usePlanName,
} from './plans';
import {
  BROKER_AUTOMATIONS,
  BROKER_PIPELINE_COUNTS,
  BROKER_PORTAL_LISTINGS,
  BROKER_STAGES,
  DEMO_BROKER,
} from './preview-data';
import { CreciFooter, ListingMini, PreviewFigure } from './previews';
import {
  AudienceBreadcrumb,
  AudienceJsonLd,
  CONTAINER,
  FaqSection,
  FinalCta,
  PreviewNote,
  Section,
  SectionHeading,
  linkButtonClass,
} from './shared';

const FAQ_KEYS = [
  'free',
  'conversation',
  'automationContact',
  'whatsapp',
  'assistant',
  'change',
] as const;

export function useBrokersFaq(): FaqItem[] {
  const t = useTranslations('audience.brokers.faq');
  const name = usePlanName();
  const whatsappPlan = firstPlanWith('whatsapp_connected');
  const values = {
    properties: formatCount(limitOf('free', 'active_properties') ?? 0),
    contacts: formatCount(limitOf('free', 'crm_contacts') ?? 0),
    plan: whatsappPlan ? name(planKey(whatsappPlan)) : '',
  };
  return FAQ_KEYS.map((key) => ({
    key,
    question: t(`${key}.q`),
    answer: t(`${key}.a`, values),
  }));
}

type NavKey = 'home' | 'inbox' | 'contacts' | 'pipeline' | 'calendar' | 'automations';

/** Side nav of the product pictures (CRM): the active item varies per picture. */
function useBrokerNav(): (active: NavKey) => AppPreviewNavItem[] {
  const t = useTranslations('audience.preview.nav');
  const items: { key: NavKey; icon: ReactNode }[] = [
    { key: 'home', icon: <LayoutDashboard strokeWidth={1.6} /> },
    { key: 'inbox', icon: <Inbox strokeWidth={1.6} /> },
    { key: 'contacts', icon: <Contact strokeWidth={1.6} /> },
    { key: 'pipeline', icon: <Filter strokeWidth={1.6} /> },
    { key: 'calendar', icon: <CalendarDays strokeWidth={1.6} /> },
    { key: 'automations', icon: <Workflow strokeWidth={1.6} /> },
  ];
  return (active) =>
    items.map((item) => ({ ...item, label: t(item.key), active: item.key === active }));
}

/** One "O dia a dia" row: text on one side, a product picture on the other. */
function DailyRow({
  title,
  description,
  example,
  picture,
  reverse,
}: {
  title: string;
  description: string;
  example: string;
  picture: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center lg:gap-12">
      <div className={reverse ? 'lg:order-2' : undefined}>
        <h3 className="type-title">{title}</h3>
        <p className="mt-2 type-body text-fg-strong">{description}</p>
        <p className="mt-3 border-l-2 border-line pl-3 type-body-s text-fg-muted">{example}</p>
      </div>
      {picture}
    </div>
  );
}

const TOOLS: {
  key: 'page' | 'crm' | 'automations' | 'assistant';
  feature: Feature;
  icon: ReactNode;
}[] = [
  { key: 'page', feature: 'broker_page', icon: <House strokeWidth={1.6} /> },
  { key: 'crm', feature: 'pipeline_and_calendar', icon: <Contact strokeWidth={1.6} /> },
  { key: 'automations', feature: 'comment_to_dm', icon: <Workflow strokeWidth={1.6} /> },
  { key: 'assistant', feature: 'agent_books_visits', icon: <Bot strokeWidth={1.6} /> },
];

/**
 * Landing page for independent brokers (mockup landing-pages/02-brokers, CRM release): page,
 * CRM, automations and the visit assistant, with the plan ladder from the catalog.
 */
export function BrokersScreen() {
  const t = useTranslations('audience.brokers');
  const tTags = useTranslations('audience.tags');
  const tCommon = useTranslations('audience.common');
  const tPrices = useTranslations('audience.prices');
  const tPreview = useTranslations('audience.preview');
  const faq = useBrokersFaq();
  const nav = useBrokerNav();
  const name = usePlanName();
  const ladder = usePlanLadder();
  const freeCount = formatCount(limitOf('free', 'active_properties') ?? 0);
  const summary = t('summary', { count: freeCount, price: planPrice(cheapestPaid()) });

  const appFrame = (props: {
    label: string;
    title: ReactNode;
    active: NavKey;
    children: ReactNode;
  }) => (
    <AppPreviewFrame
      label={props.label}
      url={tPreview('url')}
      title={props.title}
      userName={DEMO_BROKER.name}
      nav={nav(props.active)}
      note={<PreviewNote />}
    >
      {props.children}
    </AppPreviewFrame>
  );
  const startLink = (
    location: string,
    label: string,
    variant: 'primary' | 'attention' = 'primary',
  ) => (
    <Link
      href={signupHref('free')}
      data-track="select_plan"
      data-track-plan="free"
      data-track-location={location}
      className={linkButtonClass(variant)}
    >
      {label}
    </Link>
  );

  return (
    <>
      <AudienceJsonLd
        path="/para-corretores"
        homeLabel={tCommon('home')}
        pageLabel={t('meta.breadcrumb')}
        faq={faq}
        offers={PAID_PLANS.map((plan) => ({
          name: tPrices('offerName', { plan: name(planKey(plan)) }),
          priceCents: plan.monthly_cents,
          monthly: true,
        }))}
      />

      <AudienceBreadcrumb page={t('meta.breadcrumb')} />

      <div
        className={`${CONTAINER} grid grid-cols-1 gap-10 pt-4 pb-10 md:pt-6 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center`}
      >
        <div className="flex flex-col gap-5">
          <span className="inline-flex self-start rounded-pill bg-fg px-2.5 py-1 type-caption font-semibold text-white">
            {t('tag')}
          </span>
          <h1 className="type-display-xl text-balance">{t('title')}</h1>
          <p className="max-w-[60ch] type-body text-fg-strong">{t('subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            {startLink('for_brokers_hero', t('ctaStart'))}
            <a href="#planos" className={linkButtonClass('secondary')}>
              {t('ctaPlans')}
            </a>
          </div>
          <p className="type-body-s text-fg-strong">{summary}</p>
        </div>
        {appFrame({
          label: t('hero.label'),
          title: t('hero.title'),
          active: 'inbox',
          children: (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.3fr_1fr]">
              <div className="flex flex-col gap-1.5 rounded-control border border-line p-2">
                <span className="text-fg-muted">{t('hero.channel')}</span>
                <span className="self-start rounded-chip bg-subtle p-1.5">{t('hero.lead')}</span>
                <span className="self-end text-fg-muted">{t('hero.assistant')}</span>
                <span className="self-end rounded-chip bg-action-subtle p-1.5 text-action-hover">
                  {t('hero.reply')}
                </span>
                <span className="self-start rounded-chip bg-subtle p-1.5">{t('hero.answer')}</span>
                <span className="self-start rounded-chip bg-success-subtle p-1.5 font-semibold text-success">
                  ✓ {t('hero.booked')}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1 rounded-control border border-line p-2">
                  <span className="font-semibold">{t('hero.pipeline')}</span>
                  {(
                    Object.keys(BROKER_PIPELINE_COUNTS) as (keyof typeof BROKER_PIPELINE_COUNTS)[]
                  ).map((stage) => (
                    <span key={stage} className="flex justify-between gap-2">
                      <span>{t(`hero.stages.${stage}`)}</span>
                      <span className="font-mono font-semibold tabular">
                        {BROKER_PIPELINE_COUNTS[stage]}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-1 rounded-control border border-line p-2">
                  <span className="font-semibold">{t('hero.agenda')}</span>
                  <span className="rounded-chip bg-action-subtle px-1.5 text-action-hover">
                    {t('hero.slotBooked')}
                  </span>
                  <span className="text-fg-muted">{t('hero.slotFree')}</span>
                </div>
              </div>
            </div>
          ),
        })}
      </div>

      <Section tone="panel" labelledBy="tools-title" className="flex flex-col gap-8">
        <SectionHeading
          id="tools-title"
          eyebrow={t('tools.eyebrow')}
          title={t('tools.title')}
          subtitle={t('tools.subtitle')}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => {
            const from = firstPlanWith(tool.feature);
            return (
              <FeatureCard
                key={tool.key}
                icon={tool.icon}
                title={t(`tools.${tool.key}.title`)}
                description={
                  <>
                    {t(`tools.${tool.key}.description`)}
                    {from ? (
                      <a
                        href={`#${planAnchor(planKey(from))}`}
                        className="mt-3 block type-caption font-semibold text-action hover:underline"
                      >
                        {t('tools.from', { plan: name(planKey(from)) })}
                      </a>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </div>
      </Section>

      <Section id="como-funciona" labelledBy="how-title" className="flex flex-col gap-8">
        <SectionHeading id="how-title" eyebrow={t('how.eyebrow')} title={t('how.title')} />
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['publish', 'interest', 'reply', 'visit'] as const).map((key, i) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-card border border-line bg-panel p-5"
            >
              <span aria-hidden="true" className="font-mono type-body-s font-semibold text-action">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="type-body font-semibold">{t(`how.${key}.title`)}</h3>
              <p className="type-body-s text-fg-strong">{t(`how.${key}.description`)}</p>
              <p className="mt-auto rounded-control border border-line px-2 py-1.5 type-caption text-fg-strong">
                <span className="sr-only">{t('how.label')}: </span>
                {t(`how.${key}.chip`)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="panel" labelledBy="daily-title" className="flex flex-col gap-12">
        <SectionHeading id="daily-title" eyebrow={t('daily.eyebrow')} title={t('daily.title')} />
        <DailyRow
          title={t('daily.crm.title')}
          description={t('daily.crm.description')}
          example={t('daily.crm.example')}
          picture={appFrame({
            label: t('daily.crm.label'),
            title: t('hero.pipeline'),
            active: 'pipeline',
            children: (
              <div className="grid grid-cols-4 gap-1.5">
                {BROKER_STAGES.map((column) => (
                  <div
                    key={column.key}
                    className="flex flex-col gap-1 rounded-chip bg-subtle p-1.5"
                  >
                    <span className="text-fg-muted">
                      {column.title} {column.cards.length}
                    </span>
                    {column.cards.map((card) => (
                      <span
                        key={card.name}
                        className="rounded-chip border border-line bg-panel p-1.5"
                      >
                        <span className="block font-semibold">{card.name}</span>
                        <span className="block text-fg-muted">{card.area}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ),
          })}
        />
        <DailyRow
          reverse
          title={t('daily.automations.title')}
          description={t('daily.automations.description')}
          example={t('daily.automations.example')}
          picture={appFrame({
            label: t('daily.automations.label'),
            title: t('daily.automations.title'),
            active: 'automations',
            children: (
              <ul className="flex flex-col gap-1.5">
                {BROKER_AUTOMATIONS.map((a) => (
                  <li
                    key={a.key}
                    className="flex items-center justify-between gap-2 rounded-chip border border-line p-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{a.title}</span>
                      <span className="block text-fg-muted">{a.detail}</span>
                    </span>
                    <span
                      className={
                        a.active
                          ? 'shrink-0 rounded-chip bg-success-subtle px-1.5 text-success'
                          : 'shrink-0 rounded-chip bg-attention-subtle px-1.5 text-attention-fg'
                      }
                    >
                      {a.active ? t('daily.automations.active') : t('daily.automations.paused')}
                    </span>
                  </li>
                ))}
              </ul>
            ),
          })}
        />
        <DailyRow
          title={t('daily.assistant.title')}
          description={t('daily.assistant.description')}
          example={t('daily.assistant.example')}
          picture={appFrame({
            label: t('daily.assistant.label'),
            title: t('daily.assistant.screen'),
            active: 'automations',
            children: (
              <dl className="flex flex-col divide-y divide-line rounded-control border border-line">
                {(
                  [
                    ['slots', 'alone'],
                    ['book', 'alone'],
                    ['stage', 'approval'],
                    ['price', 'never'],
                  ] as const
                ).map(([rule, mode]) => (
                  <div key={rule} className="flex justify-between gap-2 p-2">
                    <dt>{t(`daily.assistant.rules.${rule}`)}</dt>
                    <dd className="font-semibold">{t(`daily.assistant.${mode}`)}</dd>
                  </div>
                ))}
              </dl>
            ),
          })}
        />
      </Section>

      <Section labelledBy="portal-title" className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-4">
            <AudienceTag kind="portal" className="self-start">
              {tTags('portal')}
            </AudienceTag>
            <h2 id="portal-title" className="type-display-l text-balance">
              {t('portal.title')}
            </h2>
            <p className="type-body text-fg-strong">{t('portal.body')}</p>
            <CheckList
              items={[
                t('portal.limits', {
                  list: PLANS.filter((p) => p.key !== 'agency')
                    .map((p) =>
                      t('portal.limitItem', {
                        plan: name(planKey(p)),
                        count: formatCount(p.limits.active_properties ?? 0),
                      }),
                    )
                    .join(' · '),
                }),
                t('portal.rules'),
                t('portal.sponsored'),
              ]}
            />
          </div>
          <PreviewFigure label={t('portal.label')} note={<PreviewNote />}>
            <div className="grid grid-cols-2 gap-3">
              {BROKER_PORTAL_LISTINGS.map((l) => (
                <ListingMini
                  key={l.key}
                  kicker={l.kicker}
                  price={`${formatBRL(l.price.cents)}${l.price.monthly ? '/mês' : ''}`}
                  specs={l.specs}
                  footer={<CreciFooter {...DEMO_BROKER} />}
                />
              ))}
            </div>
          </PreviewFigure>
        </div>
      </Section>

      <Section id="planos" tone="panel" labelledBy="plans-title" className="flex flex-col gap-8">
        <SectionHeading id="plans-title" eyebrow={t('plans.eyebrow')} title={t('plans.title')} />
        <PlanCards location="for_brokers_plans" />
        <PlanExtras />
        <Link
          href="/precos"
          className="inline-flex min-h-11 items-center self-start type-body-s font-semibold text-action hover:underline"
        >
          {t('plans.compare')} →
        </Link>
      </Section>

      <Section labelledBy="choose-title" className="flex flex-col gap-8">
        <SectionHeading id="choose-title" eyebrow={t('choose.eyebrow')} title={t('choose.title')} />
        <ul className="flex max-w-4xl flex-col divide-y divide-line border-y border-line">
          {PLANS.map((plan) => {
            const key = planKey(plan);
            return (
              <li key={key}>
                <a
                  href={`#${planAnchor(key)}`}
                  className="flex min-h-12 items-center justify-between gap-4 py-2 type-body-s hover:bg-subtle"
                >
                  <span className="text-fg-strong">{t(`choose.${key}`)}</span>
                  <span className="shrink-0 font-semibold text-action">{name(key)} →</span>
                </a>
              </li>
            );
          })}
        </ul>
      </Section>

      <FaqSection items={faq} />

      <FinalCta
        title={t('final.title')}
        subtitle={ladder()}
        action={startLink('for_brokers_final', t('final.cta'), 'attention')}
      />
    </>
  );
}
