'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

import { DemoBadge } from '@/components/badges';
import { DEMO_AUCTION_CRITERIA, readAuctionCriteria } from '@/lib/data/auction';
import { USE_MOCKS } from '@/mocks/clock';

const noop = () => () => {};

/** Mockup 61: /leilao/confirmado shows the criteria just sent and asks for "SIM". */
export function AuctionConfirmation() {
  const t = useTranslations('auction');
  const tForm = useTranslations('auction.form');
  const params = useSearchParams();
  const raw = useSyncExternalStore(
    noop,
    () => window.sessionStorage.getItem('casvitta.auction.criteria'),
    () => null,
  );
  const demo = USE_MOCKS && params.get('demo') === '1';
  const stored = raw ? readAuctionCriteria() : null;
  const criteria = stored ?? (demo ? DEMO_AUCTION_CRITERIA : null);

  const rows = criteria
    ? ([
        ['region', criteria.regions],
        ['kinds', criteria.property_kinds.map((k) => tForm(`kind.${k}`)).join(', ')],
        ['price', tForm(`prices.${criteria.price_range}`)],
        ['payment', tForm(`payments.${criteria.payment}`)],
        ['purpose', tForm(`purposes.${criteria.purpose}`)],
      ] as const)
    : [];

  const button =
    'flex min-h-12 w-full items-center justify-center rounded-control px-5 type-body-s font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] max-w-xl flex-col px-4 pt-6">
      <div className="flex flex-1 flex-col gap-4">
        {demo && !stored ? <DemoBadge className="self-start" /> : null}
        <span
          aria-hidden="true"
          className="flex size-13 items-center justify-center rounded-full bg-success-subtle text-success"
        >
          <CircleCheck strokeWidth={1.8} className="size-7" />
        </span>
        <h1 className="type-display-l text-[28px] leading-9">{t('done.title')}</h1>
        <p className="type-body text-fg-strong">
          {t.rich(params.get('confirmacao') === 'pendente' ? 'done.queued' : 'done.reply', {
            b: (chunks) => <strong className="text-fg">{chunks}</strong>,
          })}
        </p>
        {criteria ? (
          <section
            aria-labelledby="criteria-title"
            className="rounded-card border border-line bg-panel px-4 py-3"
          >
            <h2 id="criteria-title" className="border-b border-line pb-1 type-body-s font-semibold">
              {t('done.criteria')}
            </h2>
            <dl>
              {rows.map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between gap-4 border-b border-line py-2.5 last:border-b-0"
                >
                  <dt className="type-body-s text-fg-strong">{t(`done.rows.${key}`)}</dt>
                  <dd className="text-right type-body-s font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <p className="type-caption">{t('done.noDate')}</p>
      </div>
      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-col gap-2 border-t border-line bg-panel px-4 py-4">
        <Link href="/leilao#como-funciona" className={`${button} bg-action text-white`}>
          {t('done.how')}
        </Link>
        <Link href="/leilao" className={`${button} border border-fg bg-panel text-fg`}>
          {t('done.adjust')}
        </Link>
      </div>
    </div>
  );
}
