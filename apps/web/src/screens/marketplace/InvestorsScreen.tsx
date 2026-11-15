import { Badge, Callout, EstimateBox, PropertyCard, cn } from '@casvitta/ui';
import { Building2, FileText, Megaphone, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { CreciBadge, DemoBadge, SoonBadge } from '@/components/badges';
import { investmentEstimate, listPublicListings } from '@/lib/data/marketplace';
import { INSTITUTIONAL_FRONTS as FRONTS } from '@/lib/data/investors';
import { formatBRL, formatPercent } from '@/lib/format';
import { searchPath, parseFilters } from '@/lib/search-params';

import { InstitutionalForm, RentalAdminInterest } from './InvestorForms';

const FRONT_ICONS = {
  operations: Building2,
  leasing: Megaphone,
  tenant_risk: Users,
  origination: Search,
  data: FileText,
} as const;
const PILOT = ['0', '1', '2', '3'] as const;

const linkButton = (variant: 'primary' | 'secondary') =>
  cn(
    'inline-flex min-h-11 items-center justify-center rounded-control px-5 type-body-s font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    variant === 'primary'
      ? 'bg-action text-white hover:bg-action-hover'
      : 'border border-fg bg-panel text-fg hover:bg-subtle',
  );

/** Mockup 58: /investidores. #pf uses what exists today; #gestores is pilot interest only. */
export async function InvestorsScreen() {
  const t = await getTranslations('investors');
  const tCard = await getTranslations('search.card');
  const tKinds = await getTranslations('listing.kinds');
  const investPath = searchPath({ ...parseFilters(new URLSearchParams(), 'sale'), invest: true });

  // Example card: a real listing whose estimate passes the comparables rule (rule 12).
  const example = listPublicListings()
    .map((l) => ({ ...l, estimate: investmentEstimate(l.property) }))
    .filter((l) => l.estimate)
    .sort((a, b) => b.estimate!.comparables - a.estimate!.comparables)[0];

  return (
    <>
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 pt-8 pb-14 md:px-8 md:pt-14 xl:px-20">
        <section className="flex flex-col gap-5">
          <p className="type-eyebrow">{t('eyebrow')}</p>
          <h1 className="max-w-[24ch] type-display-l md:text-[48px] md:leading-[54px]">
            {t('title')}
          </h1>
          <p className="max-w-[62ch] type-body text-fg-strong">{t('subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#pf" className={linkButton('primary')}>
              {t('ctaPf')}
            </a>
            <a href="#gestores" className={linkButton('secondary')}>
              {t('ctaManagers')}
            </a>
          </div>
        </section>

        <section
          id="pf"
          aria-labelledby="pf-title"
          className="grid scroll-mt-20 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start"
        >
          <div className="flex flex-col gap-4">
            <p className="type-eyebrow">{t('pf.eyebrow')}</p>
            <h2 id="pf-title" className="type-title md:text-[26px] md:leading-8">
              {t('pf.title')}
            </h2>
            <ul className="list-disc pl-5 type-body-s text-fg-strong">
              {(['filter', 'simulation', 'broker', 'admin'] as const).map((key) => (
                <li key={key} className="py-0.5">
                  {t.rich(`pf.bullets.${key}`, {
                    b: (chunks) => <strong className="text-fg">{chunks}</strong>,
                  })}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-start gap-3">
              <Link href={investPath} className={linkButton('primary')}>
                {t('pf.search')}
              </Link>
              <RentalAdminInterest />
            </div>
          </div>
          {example?.estimate ? (
            <PropertyCard
              layout="horizontal"
              photoCaption={tCard('photo')}
              badges={example.property.isDemo ? <DemoBadge /> : null}
              kicker={tCard('kicker', {
                kind: tKinds(example.property.kind),
                transaction: example.property.transaction,
              })}
              title={
                <Link
                  href={`/imovel/${example.property.slug}`}
                  className="hover:underline"
                >{`${example.property.street} · ${example.property.neighborhood}`}</Link>
              }
              price={formatBRL(example.property.priceCents)}
              specs={t('pf.example.specs', {
                bedrooms: example.property.bedrooms,
                area: example.property.areaM2,
              })}
              extra={
                <EstimateBox
                  className="mt-2"
                  badge={<Badge variant="simulation">{tCard('estimateBadge')}</Badge>}
                  basis={tCard('estimateBasis', { count: example.estimate.comparables })}
                  rows={[
                    {
                      key: 'rent',
                      label: tCard('estimatedRent'),
                      value: t('pf.example.perMonth', {
                        amount: formatBRL(example.estimate.monthlyRentCents),
                      }),
                    },
                    {
                      key: 'yield',
                      label: tCard('grossYield'),
                      value: tCard('perYear', { pct: formatPercent(example.estimate.grossYield) }),
                    },
                  ]}
                />
              }
              broker={
                <>
                  {example.broker.displayName} <CreciBadge broker={example.broker} />
                </>
              }
            />
          ) : null}
        </section>
      </div>

      <section id="gestores" aria-labelledby="managers-title" className="scroll-mt-16 bg-subtle">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 md:px-8 xl:px-20">
          <div className="flex flex-col gap-2">
            <p className="type-eyebrow">{t('institutional.eyebrow')}</p>
            <h2 id="managers-title" className="type-title md:text-[26px] md:leading-8">
              {t('institutional.title')}
            </h2>
            <p className="max-w-[70ch] type-body text-fg-strong">{t('institutional.subtitle')}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FRONTS.map((key) => {
              const Icon = FRONT_ICONS[key];
              return (
                <li
                  key={key}
                  className="flex flex-col gap-2 rounded-card border border-dashed border-line-dashed bg-panel p-4"
                >
                  <div className="flex items-center justify-between">
                    <Icon aria-hidden="true" strokeWidth={1.6} className="size-5 text-action" />
                    <SoonBadge />
                  </div>
                  <p className="type-body font-semibold">
                    {t(`institutional.fronts.${key}.title`)}
                  </p>
                  <p className="type-body-s text-fg-strong">
                    {t(`institutional.fronts.${key}.description`)}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
            <div className="flex flex-col gap-3">
              <h3 className="type-title text-[20px]">{t('institutional.pilot.title')}</h3>
              <ol className="list-decimal pl-5 type-body-s text-fg-strong">
                {PILOT.map((i) => (
                  <li key={i} className="py-0.5">
                    {t(`institutional.pilot.steps.${i}`)}
                  </li>
                ))}
              </ol>
              <Callout>{t('institutional.disclaimer')}</Callout>
            </div>
            <InstitutionalForm />
          </div>
        </div>
      </section>
    </>
  );
}
