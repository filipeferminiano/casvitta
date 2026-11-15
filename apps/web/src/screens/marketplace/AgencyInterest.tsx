'use client';

import { Button, Input } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { InterestForm } from './InterestForm';

/** "Quero ser avisado do Agency OS" (54): opens the agency waitlist form (rule 9/11). */
export function AgencyInterest() {
  const t = useTranslations('forBrokers.agencies.form');
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [brokers, setBrokers] = useState('');
  const [city, setCity] = useState('');
  const [errors, setErrors] = useState<{ company?: string; brokers?: string }>({});

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="w-full border-dashed"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        {t('open')}
      </Button>
    );
  }

  return (
    <InterestForm
      kind="agency"
      title={t('title')}
      description={t('description')}
      contactConsentLabel={t('consent')}
      submitLabel={t('submit')}
      successTitle={t('successTitle')}
      successDescription={t('successDescription')}
      fields={
        <>
          <Input
            label={t('company')}
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            error={errors.company}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('brokers')}
              inputMode="numeric"
              value={brokers}
              onChange={(e) => setBrokers(e.target.value.replace(/\D/g, ''))}
              error={errors.brokers}
            />
            <Input label={t('city')} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </>
      }
      buildCriteria={() => {
        const next: typeof errors = {};
        if (company.trim().length < 2) next.company = t('companyError');
        const count = brokers ? Number(brokers) : null;
        if (count !== null && (count < 1 || count > 5000)) next.brokers = t('brokersError');
        setErrors(next);
        if (Object.keys(next).length) return { ok: false };
        return {
          ok: true,
          criteria: {
            company: company.trim(),
            brokers_count: count,
            city: city.trim() || null,
          },
        };
      }}
    />
  );
}
