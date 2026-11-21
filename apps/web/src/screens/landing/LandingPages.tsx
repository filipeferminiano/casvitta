import { Avatar, Button, Chip, PhotoPlaceholder } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AiBadge, CreciBadge, DemoBadge, SimulationBadge } from '@/components/badges';
import type { BrokerProfile } from '@/domain/types';
import { listPublicListings, type PublicListing } from '@/lib/data/marketplace';
import { simulateSac } from '@/lib/finance';
import { formatBRL } from '@/lib/format';
import { ListingGrid } from '@/screens/marketplace/ListingGrid';

/**
 * Landing pages are generated from existing records (CLAUDE.md §5: never free HTML). Links are
 * relative to the broker's host ({slug}.casvitta.com.br), so "/apto-vila-mariana" is the property.
 */

const whatsappUrl = (broker: BrokerProfile) => `https://wa.me/${broker.phoneE164.replace('+', '')}`;

/** Mockup 41. */
export async function BrokerLanding({ broker }: { broker: BrokerProfile }) {
  const t = await getTranslations('landing');
  const listings = listPublicListings().filter((l) => l.broker.id === broker.id);
  const first = listings[0];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={broker.displayName} size={52} className="size-20 text-[26px]" />
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="type-display-l">{broker.displayName}</h1>
            {broker.isDemo ? <DemoBadge /> : null}
          </div>
          <p className="type-body text-fg-muted">
            {t('brokerRole', { regions: new Intl.ListFormat('pt-BR').format(broker.regions) })}
          </p>
          <CreciBadge broker={broker} />
        </div>
      </header>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={whatsappUrl(broker)} target="_blank" rel="noopener noreferrer">
            {t('whatsapp')}
          </a>
        </Button>
        {first ? (
          <Button asChild variant="secondary">
            <Link href={`/${first.property.slug}`}>{t('schedule')}</Link>
          </Button>
        ) : null}
      </div>
      <section className="flex flex-col gap-4">
        <h2 className="type-title">{t('available')}</h2>
        <ListingGrid
          listings={listings}
          hrefFor={(l) => `/${l.property.slug}`}
          emptyTitle={t('noListingsTitle')}
          emptyDescription={t('noListingsDescription')}
        />
      </section>
    </div>
  );
}

/** Mockup 40. */
export async function PropertyLanding({ listing }: { listing: PublicListing }) {
  const t = await getTranslations('landing.property');
  const tListing = await getTranslations('listing');
  const { property: p, broker, creative } = listing;
  const sim = simulateSac({
    priceCents: p.priceCents,
    downPaymentCents: Math.round(p.priceCents * 0.2),
  });
  const kind = tListing(`kinds.${p.kind}`);
  const priceText =
    p.transaction === 'rent'
      ? tListing('perMonth', { amount: formatBRL(p.priceCents) })
      : formatBRL(p.priceCents);
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="grid h-[320px] grid-cols-[2fr_1fr] grid-rows-2 gap-2 sm:h-[430px]">
        <PhotoPlaceholder caption={tListing('mainPhoto')} className="row-span-2 rounded-card">
          <span className="absolute right-3 bottom-3">
            <CreciBadge broker={broker} className="bg-panel" />
          </span>
        </PhotoPlaceholder>
        <PhotoPlaceholder caption={tListing('photoN', { n: 2 })} className="rounded-card" />
        <PhotoPlaceholder
          caption={p.hasFloorplan ? tListing('floorplan') : tListing('photoN', { n: 3 })}
          className="rounded-card"
        />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="type-body-s text-fg-muted">
            {t('kicker', {
              kind,
              transaction: p.transaction,
              neighborhood: p.neighborhood,
              city: p.city,
            })}
          </p>
          {p.isDemo ? <DemoBadge /> : null}
        </div>
        <div className="flex flex-col gap-2">
          {creative ? <AiBadge className="self-start" /> : null}
          <h1 className="border-l-4 border-action pl-3 type-title text-[24px] leading-8">
            {creative?.title ?? `${kind} · ${p.neighborhood}`}
          </h1>
        </div>
        <div>
          <p className="type-eyebrow">{t('price')}</p>
          <p className="font-mono text-[32px] leading-10 font-semibold tabular">{priceText}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [tListing('specs.area'), `${p.areaM2} m²`],
            [tListing('specs.bedrooms'), String(p.bedrooms)],
            [tListing('specs.parking'), String(p.parking)],
            [tListing('specs.condo'), p.condoFeeCents ? formatBRL(p.condoFeeCents) : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-control border border-line bg-panel px-3 py-2">
              <dt className="type-caption">{label}</dt>
              <dd className="font-mono type-body font-semibold tabular">{value}</dd>
            </div>
          ))}
        </dl>
        {creative?.highlights.length ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="type-eyebrow">{t('highlights')}</p>
              <AiBadge />
            </div>
            <div className="flex flex-wrap gap-2">
              {creative.highlights.map((h) => (
                <Chip key={h} tone="info">
                  {h}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
        {p.transaction === 'sale' ? (
          <section className="flex flex-wrap items-end justify-between gap-3 rounded-control bg-canvas p-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="type-eyebrow text-action">{t('simulation')}</p>
                <SimulationBadge />
              </div>
              <p className="font-mono text-[20px] font-semibold tabular">
                {tListing('perMonth', {
                  amount: formatBRL(Math.round(sim.firstInstallmentCents / 100) * 100),
                })}
              </p>
            </div>
            <p className="max-w-[34ch] text-right type-caption">
              {t('simulationDetails', { term: sim.termMonths })}
            </p>
          </section>
        ) : null}
        <footer className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <Avatar name={broker.displayName} size={40} />
            <div className="flex flex-col items-start gap-1">
              <span className="type-body-s font-semibold">{broker.displayName}</span>
              <CreciBadge broker={broker} />
            </div>
          </div>
          <Button asChild>
            <a
              href={`${whatsappUrl(broker)}?text=${encodeURIComponent(t('whatsappText', { property: p.shortName }))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('schedule')}
            </a>
          </Button>
        </footer>
      </div>
    </div>
  );
}
