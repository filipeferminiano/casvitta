'use client';

import { CurrencyInput, Input, SegmentedControl, Select } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { InterestForm } from './InterestForm';

const KINDS = ['apartment', 'house', 'land', 'commercial'] as const;
type Kind = (typeof KINDS)[number];

/** "00000000" -> "00000-000" while typing. */
export function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Mockup 56 form: owner asks to be contacted by a CRECI broker (kind owner_listing). */
export function OwnerListingForm() {
  const t = useTranslations('owner.form');
  const [transaction, setTransaction] = useState<'sale' | 'rent'>('sale');
  const [cep, setCep] = useState('');
  const [kind, setKind] = useState<Kind>('apartment');
  const [bedrooms, setBedrooms] = useState('');
  const [area, setArea] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ cep?: string; area?: string; bedrooms?: string }>({});

  return (
    <InterestForm
      kind="owner_listing"
      title={t('title')}
      contactConsentLabel={t('consent')}
      submitLabel={t('submit')}
      successTitle={t('successTitle')}
      successDescription={t('successDescription')}
      phoneLabel={t('whatsapp')}
      arrange={({ name, phone }) => (
        <>
          <SegmentedControl
            label={t('transaction')}
            className="flex w-full [&>*]:flex-1"
            value={transaction}
            onValueChange={(v) => setTransaction(v as 'sale' | 'rent')}
            options={[
              { value: 'sale', label: t('sale') },
              { value: 'rent', label: t('rent') },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('cep')}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder={t('cepPlaceholder')}
              value={cep}
              onChange={(e) => setCep(maskCep(e.target.value))}
              error={errors.cep}
            />
            <Select
              label={t('kind')}
              value={kind}
              onValueChange={(v) => setKind(v as Kind)}
              options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
            />
            <Input
              label={t('bedrooms')}
              inputMode="numeric"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value.replace(/\D/g, '').slice(0, 2))}
              error={errors.bedrooms}
            />
            <Input
              label={t('area')}
              inputMode="numeric"
              placeholder={t('areaPlaceholder')}
              value={area}
              onChange={(e) => setArea(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={errors.area}
            />
          </div>
          <CurrencyInput
            label={t('price')}
            value={price}
            onValueChange={setPrice}
            help={t('priceHelp')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {name}
            {phone}
          </div>
        </>
      )}
      buildCriteria={() => {
        const next: typeof errors = {};
        if (cep.replace(/\D/g, '').length !== 8) next.cep = t('cepError');
        const areaM2 = area ? Number(area) : null;
        if (areaM2 !== null && areaM2 < 10) next.area = t('areaError');
        const rooms = bedrooms ? Number(bedrooms) : null;
        if (rooms !== null && rooms > 20) next.bedrooms = t('bedroomsError');
        setErrors(next);
        if (Object.keys(next).length) return { ok: false };
        return {
          ok: true,
          criteria: {
            transaction,
            cep,
            property_kind: kind,
            bedrooms: rooms,
            area_m2: areaM2,
            expected_price_cents: price,
          },
        };
      }}
    />
  );
}
