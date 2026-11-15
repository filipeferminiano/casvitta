'use client';

import { Input } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { InterestForm } from './InterestForm';

/** Mockup 57 form: developers waitlist (kind developer). Stores interest only (rule 11). */
export function DeveloperWaitlistForm() {
  const t = useTranslations('developers.form');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [cities, setCities] = useState('');
  const [launches, setLaunches] = useState('');
  const [errors, setErrors] = useState<{ company?: string; cities?: string }>({});

  return (
    <InterestForm
      kind="developer"
      title={t('title')}
      contactConsentLabel={t('consent')}
      submitLabel={t('submit')}
      successTitle={t('successTitle')}
      successDescription={t('successDescription')}
      arrange={({ name, phone }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('company')}
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            error={errors.company}
          />
          {name}
          <Input
            label={t('role')}
            autoComplete="organization-title"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          {phone}
          <Input
            label={t('cities')}
            placeholder={t('citiesPlaceholder')}
            value={cities}
            onChange={(e) => setCities(e.target.value)}
            error={errors.cities}
          />
          <Input
            label={t('launches')}
            inputMode="numeric"
            value={launches}
            onChange={(e) => setLaunches(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
      )}
      buildCriteria={() => {
        const next: typeof errors = {};
        if (company.trim().length < 2) next.company = t('companyError');
        const list = cities
          .split(/[,;]/)
          .map((c) => c.trim())
          .filter(Boolean);
        if (!list.length) next.cities = t('citiesError');
        setErrors(next);
        if (Object.keys(next).length) return { ok: false };
        return {
          ok: true,
          criteria: {
            company: company.trim(),
            role: role.trim() || null,
            cities: list.slice(0, 20),
            launches_per_year: launches ? Number(launches) : null,
          },
        };
      }}
    />
  );
}
