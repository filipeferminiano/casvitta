'use client';

import { Button, ChoiceChips, Input, Select } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { INSTITUTIONAL_FRONTS as FRONTS } from '@/lib/data/investors';

import { InterestForm } from './InterestForm';

const ORG_TYPES = [
  'fii_manager',
  'family_office',
  'securitizer',
  'own_portfolio',
  'other',
] as const;
const SIZES = ['up_to_10', '11_to_50', '51_to_200', 'over_200'] as const;

const splitCities = (raw: string) =>
  raw
    .split(/[,;]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 20);

/** "Avise-me da administração de aluguel" (58 #pf): rental_admin waitlist. */
export function RentalAdminInterest() {
  const t = useTranslations('investors.rentalAdmin');
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  const [count, setCount] = useState('');

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="border-dashed"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        {t('open')}
      </Button>
    );
  }
  return (
    <InterestForm
      kind="rental_admin"
      className="w-full"
      title={t('title')}
      description={t('description')}
      contactConsentLabel={t('consent')}
      submitLabel={t('submit')}
      successTitle={t('successTitle')}
      successDescription={t('successDescription')}
      fields={
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('city')} value={city} onChange={(e) => setCity(e.target.value)} />
          <Input
            label={t('count')}
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
        </div>
      }
      buildCriteria={() => ({
        ok: true,
        criteria: {
          city: city.trim() || null,
          properties_count: count && Number(count) > 0 ? Number(count) : null,
        },
      })}
    />
  );
}

/** "Agendar uma conversa" (58 #gestores): investor_institutional pilot interest. */
export function InstitutionalForm() {
  const t = useTranslations('investors.institutional.form');
  const tFronts = useTranslations('investors.institutional.fronts');
  const [company, setCompany] = useState('');
  const [orgType, setOrgType] = useState<string>('fii_manager');
  const [size, setSize] = useState<string>('up_to_10');
  const [cities, setCities] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ company?: string; cities?: string; interests?: string }>(
    {},
  );

  return (
    <InterestForm
      kind="investor_institutional"
      title={t('title')}
      contactConsentLabel={t('consent')}
      submitLabel={t('submit')}
      successTitle={t('successTitle')}
      successDescription={t('successDescription')}
      arrange={({ name, phone }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {name}
            <Input
              label={t('company')}
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              error={errors.company}
            />
            <Select
              label={t('type')}
              value={orgType}
              onValueChange={setOrgType}
              options={ORG_TYPES.map((v) => ({ value: v, label: t(`types.${v}`) }))}
            />
            <Select
              label={t('size')}
              value={size}
              onValueChange={setSize}
              options={SIZES.map((v) => ({ value: v, label: t(`sizes.${v}`) }))}
            />
            <Input
              label={t('cities')}
              placeholder={t('citiesPlaceholder')}
              value={cities}
              onChange={(e) => setCities(e.target.value)}
              error={errors.cities}
            />
            {phone}
          </div>
          <ChoiceChips
            label={t('interests')}
            name="interests"
            multiple
            value={interests}
            onChange={setInterests}
            error={errors.interests}
            options={FRONTS.map((v) => ({ value: v, label: tFronts(`${v}.short`) }))}
          />
        </>
      )}
      buildCriteria={() => {
        const next: typeof errors = {};
        if (company.trim().length < 2) next.company = t('companyError');
        const list = splitCities(cities);
        if (!list.length) next.cities = t('citiesError');
        if (!interests.length) next.interests = t('interestsError');
        setErrors(next);
        if (Object.keys(next).length) return { ok: false };
        return {
          ok: true,
          criteria: {
            company: company.trim(),
            org_type: orgType,
            portfolio_size: size,
            cities: list,
            interests,
          },
        };
      }}
    />
  );
}
