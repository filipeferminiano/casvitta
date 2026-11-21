'use client';

import { Button, Input, Panel, SegmentedControl, Select, formatBRL } from '@casvitta/ui';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { OwnerPack } from '@/config/site';

import { InterestForm } from '../marketplace/InterestForm';
import { startAnchor } from './anchors';

const KINDS = ['apartment', 'house', 'land', 'commercial'] as const;
type Kind = (typeof KINDS)[number];
type Transaction = 'sale' | 'rent';

const periodFromHash = (hash: string, packs: OwnerPack[]) =>
  packs.find((p) => hash === `#${startAnchor(p.days)}`) ?? null;

/**
 * Owner self-listing start (/anunciar-imovel): finalidade, tipo and cidade, then name, WhatsApp and
 * consent. Stores an interest signup (kind owner_listing_start). Nothing is charged or published:
 * payment is not wired yet, and the team finishes the listing on WhatsApp.
 */
export function OwnerStartForm({ packs }: { packs: OwnerPack[] }) {
  const t = useTranslations('audience.owners.form');
  const [step, setStep] = useState<'property' | 'contact' | 'done'>('property');
  const [transaction, setTransaction] = useState<Transaction>('sale');
  const [kind, setKind] = useState<Kind>('apartment');
  const [city, setCity] = useState('');
  const [cityError, setCityError] = useState<string | undefined>();
  const [pack, setPack] = useState<OwnerPack | null>(null);

  useEffect(() => {
    const sync = () => {
      const chosen = periodFromHash(window.location.hash, packs);
      if (chosen) setPack(chosen);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [packs]);

  const cheapest = packs.reduce((a, b) => (b.priceCents < a.priceCents ? b : a), packs[0]!);

  if (step === 'done') {
    return (
      <Panel>
        <div role="status" className="flex flex-col items-start gap-2">
          <CircleCheck aria-hidden="true" strokeWidth={1.6} className="size-8 text-success" />
          <p className="type-title">{t('successTitle')}</p>
          <p className="type-body text-fg-strong">{t('successDescription')}</p>
          <p className="type-caption">{t('successNote')}</p>
        </div>
      </Panel>
    );
  }

  if (step === 'contact') {
    return (
      <InterestForm
        kind="owner_listing_start"
        title={t('contactTitle')}
        description={
          <span className="flex flex-wrap items-center gap-x-2">
            {t('summary', {
              transaction: t(transaction),
              kind: t(`kinds.${kind}`),
              city: city.trim(),
            })}
            <button
              type="button"
              onClick={() => setStep('property')}
              className="min-h-11 font-semibold text-action hover:underline"
            >
              {t('edit')}
            </button>
          </span>
        }
        nameLabel={t('name')}
        phoneLabel={t('whatsapp')}
        contactConsentLabel={t('consent')}
        submitLabel={t('submit')}
        buildCriteria={() => ({
          ok: true,
          criteria: {
            transaction,
            property_kind: kind,
            city: city.trim(),
            period_days: pack?.days ?? null,
          },
        })}
        onSuccess={() => setStep('done')}
      />
    );
  }

  return (
    <Panel title={t('title')}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (city.trim().length < 2) {
            setCityError(t('cityError'));
            return;
          }
          setCityError(undefined);
          setStep('contact');
        }}
      >
        {/* Visible caption; the control itself is named by aria-label. */}
        <p aria-hidden="true" className="-mb-2 type-body-s font-medium">
          {t('transaction')}
        </p>
        <SegmentedControl
          label={t('transaction')}
          className="flex w-full [&>*]:flex-1"
          value={transaction}
          onValueChange={(v) => setTransaction(v as Transaction)}
          options={[
            { value: 'sale', label: t('sale') },
            { value: 'rent', label: t('rent') },
          ]}
        />
        <Select
          label={t('kind')}
          value={kind}
          onValueChange={(v) => setKind(v as Kind)}
          options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
        />
        <Input
          label={t('city')}
          autoComplete="address-level2"
          placeholder={t('cityPlaceholder')}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={cityError}
        />
        {pack ? (
          <p className="flex flex-wrap items-center gap-x-2 rounded-control bg-action-subtle px-3 py-2 type-body-s text-action-hover">
            {t('period', { days: pack.days, price: formatBRL(pack.priceCents) })}
            <button
              type="button"
              onClick={() => setPack(null)}
              className="min-h-11 font-semibold underline-offset-2 hover:underline"
            >
              {t('periodClear')}
            </button>
          </p>
        ) : null}
        <Button type="submit">{t('next')}</Button>
        <p className="type-caption">
          {t('priceNote', { price: formatBRL(cheapest.priceCents), days: cheapest.days })}
        </p>
        <Link
          href="/anunciar-imovel/corretor"
          className="inline-flex min-h-11 items-center self-start type-body-s font-semibold text-action hover:underline"
        >
          {t('brokerLink')}
        </Link>
      </form>
    </Panel>
  );
}
