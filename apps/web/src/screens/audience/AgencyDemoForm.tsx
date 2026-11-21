'use client';

import { ChoiceChips, Input, Panel, Select } from '@casvitta/ui';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { InterestForm } from '../marketplace/InterestForm';

const TEAM_SIZES = ['1_5', '6_15', '16_plus'] as const;
const RANGES = ['up_to_200', '201_to_500', 'over_500'] as const;
type Range = (typeof RANGES)[number];

/**
 * Demo request (/para-imobiliarias): name, agency, WhatsApp, e-mail, team size and active
 * properties range, consent unchecked and required. Stores an interest signup (kind agency_demo).
 */
export function AgencyDemoForm() {
  const t = useTranslations('audience.agencies.form');
  const [company, setCompany] = useState('');
  const [teamSize, setTeamSize] = useState<string[]>([]);
  const [range, setRange] = useState<Range>('up_to_200');
  const [errors, setErrors] = useState<{ company?: string; teamSize?: string }>({});
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Panel>
        <div role="status" className="flex flex-col items-start gap-2">
          <CircleCheck aria-hidden="true" strokeWidth={1.6} className="size-8 text-success" />
          <p className="type-title">{t('successTitle')}</p>
          <p className="type-body text-fg-strong">{t('successDescription')}</p>
        </div>
      </Panel>
    );
  }

  return (
    <InterestForm
      kind="agency_demo"
      nameLabel={t('name')}
      phoneLabel={t('whatsapp')}
      email={{ label: t('email'), placeholder: t('emailPlaceholder'), error: t('emailError') }}
      contactConsentLabel={t('consent')}
      submitLabel={t('submit')}
      onSuccess={() => setDone(true)}
      arrange={({ name, phone, email }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {name}
            <Input
              label={t('company')}
              autoComplete="organization"
              placeholder={t('companyPlaceholder')}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              error={errors.company}
            />
            {phone}
            {email}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceChips
              label={t('teamSize')}
              name="team_size"
              value={teamSize}
              onChange={setTeamSize}
              error={errors.teamSize}
              options={TEAM_SIZES.map((v) => ({ value: v, label: t(`teamSizes.${v}`) }))}
            />
            <Select
              label={t('activeProperties')}
              value={range}
              onValueChange={(v) => setRange(v as Range)}
              options={RANGES.map((v) => ({ value: v, label: t(`ranges.${v}`) }))}
            />
          </div>
        </>
      )}
      buildCriteria={() => {
        const next: typeof errors = {};
        if (company.trim().length < 2) next.company = t('companyError');
        if (!teamSize[0]) next.teamSize = t('teamSizeError');
        setErrors(next);
        if (Object.keys(next).length) return { ok: false };
        return {
          ok: true,
          criteria: { company: company.trim(), team_size: teamSize[0], active_properties: range },
        };
      }}
      footer={
        <p className="type-caption">
          {t('privacy')}{' '}
          <Link href="/privacidade" className="font-semibold text-action hover:underline">
            {t('privacyLink')}
          </Link>
        </p>
      }
    />
  );
}
