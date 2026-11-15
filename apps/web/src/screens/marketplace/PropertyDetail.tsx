import { Avatar, Button, PhotoPlaceholder } from '@casvitta/ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { CreciBadge, DemoBadge, SimulationBadge, SponsoredBadge } from '@/components/badges';
import type { PublicListing } from '@/lib/data/marketplace';
import { simulateSac } from '@/lib/finance';
import { formatBRL } from '@/lib/format';

import { AskBox, FinancingSimulator } from './ListingIslands';

/** Server-rendered property page (mockup 13 on desktop, 24 on phones). */
export async function PropertyDetail({ listing }: { listing: PublicListing }) {
  const t = await getTranslations('listing');
  const { property: p, broker } = listing;
  const kind = t(`kinds.${p.kind}`);
  const headline = t('headline', {
    kind,
    bedrooms: p.bedrooms,
    features: p.features.includes('Varanda') ? 'true' : 'false',
    nearby: p.nearby
      ? t('nearbyPart', { distance: p.nearby.distanceM, place: p.nearby.label })
      : '',
  });
  const sim = simulateSac({
    priceCents: p.priceCents,
    downPaymentCents: Math.round(p.priceCents * 0.2),
  });
  const firstInstallment = formatBRL(Math.round(sim.firstInstallmentCents / 100) * 100);
  const whatsapp = `https://wa.me/${broker.phoneE164.replace('+', '')}`;
  const chatHref = `/imovel/${p.slug}/conversa`;
  const priceText =
    p.transaction === 'rent'
      ? t('perMonth', { amount: formatBRL(p.priceCents) })
      : formatBRL(p.priceCents);

  return (
    <>
      {/* Phone (mockup 24) */}
      <div className="pb-28 md:hidden">
        <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2">
          <Link
            href="/comprar"
            aria-label={t('back')}
            className="-ml-2 flex size-11 items-center justify-center"
          >
            <ChevronLeft aria-hidden="true" strokeWidth={1.6} className="size-5" />
          </Link>
          {p.isDemo ? <DemoBadge /> : null}
        </div>
        <PhotoPlaceholder
          caption={t('photoOf', { n: 1, total: p.photoCount })}
          className="h-[250px] w-full"
        >
          {listing.sponsored ? (
            <span className="absolute top-3 left-3">
              <SponsoredBadge />
            </span>
          ) : null}
        </PhotoPlaceholder>
        <div className="flex flex-col gap-3 px-4 pt-4">
          <p className="type-body-s text-fg-muted">{`${kind} · ${p.neighborhood}`}</p>
          <p className="-mt-2 font-mono text-[26px] leading-8 font-semibold tabular">{priceText}</p>
          <p className="-mt-2 type-body-s text-fg-strong">
            {[
              t('bedrooms', { count: p.bedrooms }),
              `${p.areaM2} m²`,
              p.parking ? t('parking', { count: p.parking }) : null,
              p.nearby ? t('nearbyShort', { distance: p.nearby.distanceM }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {p.transaction === 'sale' ? (
            <section className="rounded-card border border-line bg-panel p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="type-body font-semibold">{t('mobile.installment')}</h2>
                <SimulationBadge />
              </div>
              <p className="mt-2 font-mono text-[20px] font-semibold tabular">
                {t('perMonth', { amount: firstInstallment })}
              </p>
              <p className="type-caption">
                {t('mobile.installmentDetails', { term: sim.termMonths })}
              </p>
              <a
                href="#simulador"
                className="mt-2 inline-block type-body-s font-semibold text-action underline underline-offset-2"
              >
                {t('mobile.simulate')}
              </a>
            </section>
          ) : null}
          <div className="flex items-center gap-3 border-t border-line pt-3">
            <Avatar name={broker.displayName} size={40} />
            <div className="flex flex-col items-start gap-1">
              <span className="type-body-s font-semibold">{broker.displayName}</span>
              <CreciBadge broker={broker} />
            </div>
          </div>
          {p.transaction === 'sale' ? (
            <div id="simulador" className="mt-2">
              <FinancingSimulator priceCents={p.priceCents} />
            </div>
          ) : null}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[auto_1fr] gap-3 border-t border-line bg-panel px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button asChild variant="secondary">
            <Link href={chatHref}>{t('chat')}</Link>
          </Button>
          <Button asChild>
            <Link href={chatHref}>{t('schedule')}</Link>
          </Button>
        </div>
      </div>

      {/* Desktop (mockup 13) */}
      <div className="mx-auto hidden max-w-7xl flex-col gap-5 px-8 py-6 md:flex xl:px-20">
        <div className="flex items-center justify-between">
          <p className="type-body-s text-fg-muted">
            {[t('breadcrumb.buy'), p.city, p.neighborhood].join(' › ')}
          </p>
          {p.isDemo ? (
            <p className="flex items-center gap-2 type-body-s text-fg-muted">
              {t('buyerView')}
              <DemoBadge />
            </p>
          ) : null}
        </div>
        <div className="grid h-[408px] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-2">
          <PhotoPlaceholder caption={t('mainPhoto')} className="row-span-2 rounded-control" />
          <PhotoPlaceholder caption={t('photoN', { n: 2 })} className="rounded-control" />
          <PhotoPlaceholder caption={t('photoN', { n: 3 })} className="rounded-control" />
          <PhotoPlaceholder
            caption={p.hasFloorplan ? t('floorplan') : t('photoN', { n: 4 })}
            className="rounded-control"
          />
          <PhotoPlaceholder
            caption={
              p.videoSeconds
                ? t('video', { seconds: `0:${String(p.videoSeconds).padStart(2, '0')}` })
                : t('photoN', { n: 5 })
            }
            className="rounded-control"
          />
        </div>
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="type-display-l">{headline}</h1>
              <p className="mt-1 type-body text-fg-muted">
                {t('address', { street: p.street, neighborhood: p.neighborhood, city: p.city })}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {[
                [t('specs.area'), `${p.areaM2} m²`],
                [t('specs.bedrooms'), String(p.bedrooms)],
                [t('specs.parking'), String(p.parking)],
                [t('specs.condo'), p.condoFeeCents ? formatBRL(p.condoFeeCents) : '—'],
                [
                  t('specs.iptu'),
                  p.iptuYearCents ? t('perYear', { amount: formatBRL(p.iptuYearCents) }) : '—',
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-control border border-line bg-panel px-3 py-2.5"
                >
                  <dt className="type-caption">{label}</dt>
                  <dd className="font-mono type-body font-semibold tabular">{value}</dd>
                </div>
              ))}
            </dl>
            {p.transaction === 'sale' ? <FinancingSimulator priceCents={p.priceCents} /> : null}
          </div>
          <aside className="flex flex-col gap-5">
            <section className="rounded-card border border-line bg-panel p-5">
              <div className="flex justify-between">
                {listing.sponsored ? <SponsoredBadge /> : <span />}
                {p.isDemo ? <DemoBadge /> : null}
              </div>
              <p className="mt-3 type-body-s text-fg-strong">
                {t('forSale', { kind, transaction: p.transaction, neighborhood: p.neighborhood })}
              </p>
              <p className="font-mono text-[30px] leading-9 font-semibold tabular">{priceText}</p>
              <div className="mt-4 flex flex-col gap-3">
                <Button asChild>
                  <Link href={chatHref}>{t('schedule')}</Link>
                </Button>
                <Button asChild variant="secondary">
                  <a href={whatsapp} rel="noopener noreferrer" target="_blank">
                    {t('whatsapp')}
                  </a>
                </Button>
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
                <Avatar name={broker.displayName} size={48} />
                <div className="flex flex-col items-start gap-1">
                  <span className="type-body-s font-semibold">{broker.displayName}</span>
                  <CreciBadge broker={broker} />
                  <span className="type-caption">{t('responsible')}</span>
                </div>
              </div>
            </section>
            <AskBox property={p} brokerFirstName={broker.firstName} />
          </aside>
        </div>
      </div>
    </>
  );
}
