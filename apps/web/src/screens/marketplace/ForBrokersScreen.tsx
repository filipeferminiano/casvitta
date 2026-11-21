import { NumberedSteps, PlanCard, cn } from '@casvitta/ui';
import { House, Megaphone, MessageSquare, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { DemoBadge, SoonBadge } from '@/components/badges';
import { LEGACY_PLANS as PLANS, SEPARATE_TOOLS_CENTS, whatsappLink } from '@/config/site';
import { formatBRL } from '@/lib/format';

import { AgencyInterest } from './AgencyInterest';

const STEPS = ['property', 'approve', 'budget', 'visits'] as const;
const INCLUDED = [
  { key: 'ads', icon: Megaphone },
  { key: 'whatsapp', icon: MessageSquare },
  { key: 'crm', icon: Users },
  { key: 'landing', icon: House },
  { key: 'social', icon: Sparkles },
] as const;
const PLAN_KEYS = ['essencial', 'profissional'] as const;

/** Demo numbers for the hero card ("Demonstrativo", rule 7). */
const DEMO_WEEK = { contacts: 14, visits: 3, costPerVisitCents: 5_800 };

const linkButton = (variant: 'primary' | 'secondary') =>
  cn(
    'inline-flex min-h-11 items-center justify-center rounded-control px-5 type-body-s font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    variant === 'primary'
      ? 'bg-action text-white hover:bg-action-hover'
      : 'border border-fg bg-panel text-fg hover:bg-subtle',
  );

/** Mockup 54: /para-corretores, with the agencies section at #imobiliarias. */
export async function ForBrokersScreen() {
  const t = await getTranslations('forBrokers');
  const tPlans = await getTranslations('plans');
  const separateTotal = Object.values(SEPARATE_TOOLS_CENTS).reduce((a, b) => a + b, 0);
  const savings = separateTotal - PLANS.profissional.priceCents;
  const savingsPct = Math.floor((savings / separateTotal) * 100);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 pt-8 pb-14 md:px-8 md:pt-14 xl:px-20">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <p className="type-eyebrow">{t('eyebrow')}</p>
          <h1 className="max-w-[22ch] type-display-l md:text-[52px] md:leading-[56px]">
            {t('title')}
          </h1>
          <p className="max-w-[60ch] type-body text-fg-strong">{t('subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/cadastro/conta"
              data-track="begin_signup"
              data-track-location="for_brokers_hero"
              className={linkButton('primary')}
            >
              {t('ctaStart')}
            </Link>
            <a
              href={whatsappLink(t('whatsappText'))}
              target="_blank"
              rel="noopener noreferrer"
              className={linkButton('secondary')}
            >
              {t('ctaWhatsApp')}
            </a>
          </div>
        </div>

        <section
          aria-label={t('week.title')}
          className="flex flex-col gap-3 rounded-card border border-line bg-panel p-4 md:p-5"
        >
          <header className="flex items-center justify-between">
            <h2 className="type-body-s font-semibold">{t('week.title')}</h2>
            <DemoBadge />
          </header>
          <dl className="grid grid-cols-3 gap-2">
            {(
              [
                ['contacts', String(DEMO_WEEK.contacts)],
                ['visits', String(DEMO_WEEK.visits)],
                ['perVisit', formatBRL(DEMO_WEEK.costPerVisitCents)],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="rounded-control bg-subtle px-3 py-2">
                <dt className="type-caption">{t(`week.${key}`)}</dt>
                <dd className="font-mono text-[18px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2 rounded-control bg-chat-bg p-3">
            <p className="type-caption font-semibold tracking-wide text-action uppercase">
              {t('week.assistant')}
            </p>
            <p className="self-start rounded-control bg-panel px-3 py-1.5 type-body-s">
              {t('week.q')}
            </p>
            <p className="self-end rounded-control bg-fg px-3 py-1.5 type-body-s text-white">
              {t('week.a')}
            </p>
            <p className="self-start rounded-control bg-panel px-3 py-1.5 type-body-s">
              {t('week.offer')}
            </p>
          </div>
        </section>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="type-title">{t('how.title')}</h2>
        <NumberedSteps
          steps={STEPS.map((key) => ({
            key,
            title: t(`how.${key}.title`),
            description: t(`how.${key}.description`),
          }))}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-2">
          <h2 className="border-b border-line pb-2 type-title">{t('included.title')}</h2>
          <ul>
            {INCLUDED.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-3 border-b border-line py-3 last:border-b-0">
                <Icon aria-hidden="true" strokeWidth={1.6} className="mt-0.5 size-4 text-action" />
                <div>
                  <p className="type-body-s font-semibold">{t(`included.${key}.title`)}</p>
                  <p className="type-caption text-fg-strong">{t(`included.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_KEYS.map((key) => (
              <PlanCard
                key={key}
                highlighted={key === 'profissional'}
                name={tPlans(`${key}.name`)}
                price={formatBRL(PLANS[key].priceCents)}
                period={tPlans('perMonth')}
                features={[
                  tPlans('upTo', { count: PLANS[key].maxActiveProperties }),
                  ...[0, 1, 2].map((i) => tPlans(`${key}.full.${i}`)),
                ]}
                action={
                  <Link
                    href={`/cadastro/conta?plano=${key}`}
                    data-track="select_plan"
                    data-track-plan={key}
                    data-track-location="for_brokers"
                    className={cn(
                      linkButton(key === 'profissional' ? 'primary' : 'secondary'),
                      'w-full',
                    )}
                  >
                    {t('choosePlan', { plan: tPlans(`${key}.name`) })}
                  </Link>
                }
              />
            ))}
          </div>
          <p className="type-body-s text-fg-strong">
            {t.rich('media', { b: (chunks) => <strong className="text-fg">{chunks}</strong> })}
          </p>

          <section
            aria-labelledby="separate-title"
            className="flex flex-col gap-3 rounded-card bg-fg p-6 text-white"
          >
            <h2
              id="separate-title"
              className="font-mono text-[12px] tracking-[0.08em] text-ink-300 uppercase"
            >
              {t('separate.title')}
            </h2>
            <p className="type-body-s text-ink-200">
              {t('separate.items', {
                crm: formatBRL(SEPARATE_TOOLS_CENTS.crm),
                site: formatBRL(SEPARATE_TOOLS_CENTS.site),
                ai: formatBRL(SEPARATE_TOOLS_CENTS.aiService),
                social: formatBRL(SEPARATE_TOOLS_CENTS.socialMedia),
                traffic: formatBRL(SEPARATE_TOOLS_CENTS.trafficManager),
              })}
            </p>
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] font-semibold">
                {formatBRL(separateTotal)}
              </span>
              <span className="type-body-s text-ink-300">{t('separate.perMonthMin')}</span>
            </p>
            <div className="border-t border-ink-700 pt-3">
              <p className="font-mono text-[26px] font-semibold text-yellow-400">
                {t('separate.savings', { amount: formatBRL(savings) })}
              </p>
              <p className="type-body-s text-ink-200">
                {t('separate.savingsDetail', { pct: savingsPct })}
              </p>
            </div>
            <p className="type-caption text-ink-300">{t('separate.footnote')}</p>
          </section>
        </div>
      </section>

      <section
        id="imobiliarias"
        aria-labelledby="agencies-title"
        className="grid scroll-mt-20 gap-6 rounded-card border border-dashed border-line-dashed bg-panel p-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="agencies-title" className="type-title">
              {t('agencies.title')}
            </h2>
            <SoonBadge />
          </div>
          <p className="type-body text-fg-strong">{t('agencies.description')}</p>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href={whatsappLink(t('agencies.whatsappText'))}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(linkButton('primary'), 'w-full')}
          >
            {t('agencies.talk')}
          </a>
          <AgencyInterest />
        </div>
      </section>
    </div>
  );
}
