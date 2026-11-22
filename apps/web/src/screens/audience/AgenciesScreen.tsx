import {
  AppPreviewFrame,
  AudienceTag,
  Avatar,
  CheckList,
  FeatureCard,
  NumberedSteps,
  UsageMeter,
  type AppPreviewNavItem,
  type FaqItem,
} from '@casvitta/ui';
import { Contact, House, LayoutGrid, Megaphone, Target, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { limitOf, planOf } from '@/config/catalog';
import { formatBRL } from '@/lib/format';

import { AgencyDemoForm } from './AgencyDemoForm';
import { PlanExtras, PlanPriceTag, formatCount, usePlanItemsFor, usePlanName } from './plans';
import {
  AGENCY_ACTIVITY,
  AGENCY_FILTERS,
  AGENCY_PORTAL_LISTINGS,
  AGENCY_PROPERTIES,
  AGENCY_USAGE,
  DEMO_AGENCY,
} from './preview-data';
import {
  CreciFooter,
  ListingMini,
  PreviewFigure,
  PreviewStatusPill,
  formatPreviewPrice,
} from './previews';
import {
  AudienceBreadcrumb,
  AudienceJsonLd,
  CONTAINER,
  FaqSection,
  PreviewNote,
  Section,
  SectionHeading,
  TagLegend,
  linkButtonClass,
} from './shared';

const FAQ_KEYS = ['choose', 'limit', 'users', 'highlight', 'migration', 'guarantee'] as const;

export function useAgenciesFaq(): FaqItem[] {
  const t = useTranslations('audience.agencies.faq');
  const agency = planOf('agency');
  const values = {
    users: limitOf('agency', 'users') ?? 0,
    max: formatCount(limitOf('agency', 'active_properties') ?? 0),
    price: formatBRL(agency.monthly_cents),
    extra: formatBRL(agency.extra_user_cents ?? 0),
  };
  return FAQ_KEYS.map((key) => ({
    key,
    question: t(`${key}.q`),
    answer: t(`${key}.a`, values),
  }));
}

/** Landing page for agencies (mockup landing-pages/03): team plans + demo form. */
export function AgenciesScreen() {
  const t = useTranslations('audience.agencies');
  const tTags = useTranslations('audience.tags');
  const tCommon = useTranslations('audience.common');
  const tPreview = useTranslations('audience.preview');
  const tNav = useTranslations('audience.preview.nav');
  const tPlans = useTranslations('audience.plans');
  const faq = useAgenciesFaq();
  const name = usePlanName();
  const agency = planOf('agency');
  const agencyItems = usePlanItemsFor();
  const tPrices = useTranslations('audience.prices');
  // The picture's meter uses the agency plan's limit ("148 de 1.000").
  const meterMax = limitOf('agency', 'active_properties') ?? AGENCY_USAGE.max;

  const nav = (active: string): AppPreviewNavItem[] =>
    [
      { key: 'properties', label: tNav('properties'), icon: <House strokeWidth={1.6} /> },
      { key: 'contacts', label: tNav('contacts'), icon: <Contact strokeWidth={1.6} /> },
      { key: 'opportunities', label: tNav('opportunities'), icon: <Target strokeWidth={1.6} /> },
      { key: 'team', label: tNav('team'), icon: <Users strokeWidth={1.6} /> },
      { key: 'portal', label: tNav('portal'), icon: <Megaphone strokeWidth={1.6} /> },
    ].map((item) => ({ ...item, active: item.key === active }));
  const usage = (
    <UsageMeter
      label={tPreview('usage')}
      value={AGENCY_USAGE.value}
      max={meterMax}
      valueLabel={tPreview('usageValue', { value: AGENCY_USAGE.value, max: formatCount(meterMax) })}
    />
  );
  const demoLink = (variant: 'primary' | 'secondary', label = t('plans.cta')) => (
    <a href="#demonstracao" className={linkButtonClass(variant)}>
      {label}
    </a>
  );

  return (
    <>
      <AudienceJsonLd
        path="/para-imobiliarias"
        homeLabel={tCommon('home')}
        pageLabel={t('meta.breadcrumb')}
        faq={faq}
        offers={[
          {
            name: tPrices('offerName', { plan: name('agency') }),
            priceCents: agency.monthly_cents,
            monthly: true,
          },
        ]}
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
            {demoLink('primary', t('ctaDemo'))}
            <a href="#planos" className={linkButtonClass('secondary')}>
              {t('ctaPlans')}
            </a>
          </div>
        </div>
        <AppPreviewFrame
          label={t('hero.label')}
          url={tPreview('url')}
          title={t('hero.title')}
          userName={DEMO_AGENCY.coordinator}
          nav={nav('properties')}
          note={<PreviewNote />}
        >
          {usage}
          <ul className="flex flex-wrap gap-1">
            <li className="rounded-pill border border-action bg-action-subtle px-2 py-0.5 font-semibold text-action-hover">
              {t('hero.all', { count: AGENCY_USAGE.value })}
            </li>
            {AGENCY_FILTERS.map((f) => (
              <li key={f.key} className="rounded-pill border border-line px-2 py-0.5">
                {f.label}
              </li>
            ))}
          </ul>
          <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
            {AGENCY_PROPERTIES.map((p) => (
              <li key={p.key} className="flex items-center gap-2 p-2">
                <span className="size-8 shrink-0 rounded-chip bg-ink-100" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.title}</span>
                  <span className="block truncate text-fg-muted">
                    {p.transaction} · {t('hero.opportunities', { count: p.opportunities })}
                  </span>
                </span>
                <span className="font-mono font-semibold tabular">
                  {formatPreviewPrice(p.priceCents)}
                </span>
                <PreviewStatusPill status={p.status} />
                <Avatar name={p.owner} size={32} className="size-6 text-[10px]" />
              </li>
            ))}
          </ul>
        </AppPreviewFrame>
      </div>

      <Section tone="panel" labelledBy="ops-title" className="flex flex-col gap-8">
        <SectionHeading id="ops-title" eyebrow={t('ops.eyebrow')} title={t('ops.title')} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              ['centralized', LayoutGrid],
              ['owner', UserCheck],
              ['tracked', Target],
            ] as const
          ).map(([key, Icon]) => (
            <FeatureCard
              key={key}
              icon={<Icon strokeWidth={1.6} />}
              title={t(`ops.${key}.title`)}
              description={t(`ops.${key}.description`)}
            />
          ))}
        </div>
      </Section>

      <Section
        labelledBy="team-title"
        className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center"
      >
        <div className="flex flex-col gap-6">
          <SectionHeading id="team-title" eyebrow={t('team.eyebrow')} title={t('team.title')} />
          <CheckList items={[0, 1, 2, 3].map((i) => t(`team.points.${i}`))} />
        </div>
        <AppPreviewFrame
          label={t('team.label')}
          url={tPreview('url')}
          title={t('team.screen')}
          userName={DEMO_AGENCY.coordinator}
          nav={nav('team')}
          note={<PreviewNote />}
        >
          <ol className="flex flex-col divide-y divide-line">
            {AGENCY_ACTIVITY.map((item) => (
              <li key={item.key} className="flex gap-3 py-2">
                <span className="w-20 shrink-0 font-mono text-fg-muted tabular">{item.when}</span>
                <span>
                  <span className="font-semibold">{item.who}</span> {item.text}
                </span>
              </li>
            ))}
          </ol>
        </AppPreviewFrame>
      </Section>

      <Section tone="panel" labelledBy="portal-title" className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-4">
            <AudienceTag kind="portal" className="self-start">
              {tTags('portal')}
            </AudienceTag>
            <h2 id="portal-title" className="type-display-l text-balance">
              {t('portal.title')}
            </h2>
            <p className="type-body text-fg-strong">{t('portal.body')}</p>
            <p className="type-caption">{t('portal.note')}</p>
          </div>
          <PreviewFigure label={t('portal.label')} note={<PreviewNote />}>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {AGENCY_PORTAL_LISTINGS.map((l) => (
                  <ListingMini
                    key={l.key}
                    highlight={l.highlight}
                    kicker={l.kicker}
                    price={formatBRL(l.priceCents)}
                    specs={l.specs}
                    footer={<CreciFooter name={DEMO_AGENCY.name} creci={DEMO_AGENCY.creci} />}
                  />
                ))}
              </div>
              {usage}
            </div>
          </PreviewFigure>
        </div>
        <TagLegend />
      </Section>

      <Section id="planos" labelledBy="plans-title" className="flex flex-col gap-8">
        <SectionHeading
          id="plans-title"
          eyebrow={t('plans.eyebrow')}
          title={t('plans.title')}
          subtitle={t('plans.subtitle')}
        />
        <article className="flex max-w-4xl flex-col gap-5 rounded-card border-2 border-action bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="type-title">{name('agency')}</h3>
              <p className="type-body-s text-fg-muted">{tPlans('taglines.agency')}</p>
            </div>
            <PlanPriceTag plan={agency} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="type-body-s font-semibold">
              {tPlans('everythingIn', { plan: name('pro') })}
            </p>
            <CheckList items={agencyItems('agency')} className="md:grid md:grid-cols-2" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {demoLink('primary')}
            <Link
              href="/precos"
              className="inline-flex min-h-11 items-center type-body-s font-semibold text-action hover:underline"
            >
              {t('plans.compare')} →
            </Link>
          </div>
          <p className="type-caption">
            {t('plans.bigger', {
              count: formatCount(limitOf('agency', 'active_properties') ?? 0),
            })}
          </p>
        </article>
        <PlanExtras className="max-w-4xl" />
      </Section>

      <Section tone="panel" labelledBy="migration-title" className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="self-start rounded-chip border border-line px-1.5 py-0.5 font-mono text-[12px] tracking-[0.08em] text-fg-muted uppercase">
            {t('migration.eyebrow')}
          </span>
          <SectionHeading
            id="migration-title"
            title={t('migration.title')}
            subtitle={t('migration.body')}
          />
        </div>
        <NumberedSteps
          steps={(['assess', 'quote', 'import'] as const).map((key) => ({
            key,
            title: t(`migration.${key}.title`),
            description: t(`migration.${key}.description`),
          }))}
        />
        <p className="type-caption">{t('migration.note')}</p>
      </Section>

      <FaqSection items={faq} />

      <Section
        id="demonstracao"
        labelledBy="demo-title"
        className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start"
      >
        <div className="flex flex-col gap-6">
          <SectionHeading
            id="demo-title"
            eyebrow={t('demo.eyebrow')}
            title={t('demo.title')}
            subtitle={t('demo.subtitle')}
          />
          <CheckList items={[0, 1, 2].map((i) => t(`demo.points.${i}`))} />
        </div>
        <AgencyDemoForm />
      </Section>
    </>
  );
}
