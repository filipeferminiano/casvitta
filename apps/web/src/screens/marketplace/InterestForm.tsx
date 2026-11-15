'use client';

import { Button, Checkbox, Input, Panel } from '@casvitta/ui';
import { CircleCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { track } from '@/lib/analytics';
import { submitInterest, type InterestPayload } from '@/lib/data/interest';

type Kind = InterestPayload['kind'];

export type CriteriaResult = { ok: true; criteria: Record<string, unknown> } | { ok: false };

/**
 * Capture form shared by the public pages (CLAUDE.md rule 11): name, WhatsApp, consent per
 * purpose, honeypot and UTM. Each page adds its own fields and builds `criteria`.
 */
export function InterestForm({
  kind,
  title,
  description,
  fields,
  buildCriteria,
  contactConsentLabel,
  marketingConsentLabel,
  submitLabel,
  onSuccess,
  successTitle,
  successDescription,
  nameLabel,
  phoneLabel,
  arrange,
  footer,
  className,
}: {
  kind: Kind;
  title?: ReactNode;
  description?: ReactNode;
  /** Page-specific fields, rendered between name and WhatsApp. */
  fields?: ReactNode;
  /** Validates the page fields; returns criteria for the API or ok:false (fields show errors). */
  buildCriteria: () => CriteriaResult;
  contactConsentLabel: string;
  /** Optional second, separate consent (marketing). */
  marketingConsentLabel?: string;
  submitLabel: string;
  onSuccess?: () => void;
  successTitle?: string;
  successDescription?: string;
  nameLabel?: string;
  phoneLabel?: string;
  /**
   * Custom order of the fields. Receives the shared name and WhatsApp inputs; defaults to
   * name, page fields, WhatsApp.
   */
  arrange?: (contact: { name: ReactNode; phone: ReactNode }) => ReactNode;
  /** Small print under the submit button. */
  footer?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('interest');
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [contact, setContact] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done && !onSuccess) {
    return (
      <Panel className={className}>
        <div role="status" className="flex flex-col items-start gap-2">
          <CircleCheck aria-hidden="true" strokeWidth={1.6} className="size-8 text-success" />
          <p className="type-title">{successTitle ?? t('successTitle')}</p>
          <p className="type-body text-fg-strong">
            {successDescription ?? t('successDescription')}
          </p>
        </div>
      </Panel>
    );
  }

  const nameInput = (
    <Input
      label={nameLabel ?? t('name')}
      autoComplete="name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      error={errors.name}
    />
  );
  const phoneInput = (
    <Input
      label={phoneLabel ?? t('whatsapp')}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder={t('whatsappPlaceholder')}
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
      error={errors.phone}
    />
  );

  return (
    <Panel title={title} className={className}>
      {description ? <p className="mb-4 -mt-1 type-body-s text-fg-strong">{description}</p> : null}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (name.trim().length < 2) next.name = t('nameError');
          if (phone.replace(/\D/g, '').length < 10) next.phone = t('phoneError');
          if (!contact) next.consent = t('consentError');
          const criteria = buildCriteria();
          setErrors(next);
          if (Object.keys(next).length || !criteria.ok) return;
          setBusy(true);
          const result = await submitInterest({
            kind,
            name: name.trim(),
            phone,
            website: website || undefined,
            consents: { contact_about_properties: contact, marketing },
            utm: {
              source: params.get('utm_source') ?? undefined,
              medium: params.get('utm_medium') ?? undefined,
              campaign: params.get('utm_campaign') ?? undefined,
            },
            source_page: typeof window === 'undefined' ? undefined : window.location.pathname,
            criteria: criteria.criteria,
          } as unknown as InterestPayload);
          setBusy(false);
          if (!result.ok) {
            setErrors({ form: result.message || t('genericError'), ...result.fields });
            return;
          }
          track({ name: 'form_submit', form: kind });
          setDone(true);
          onSuccess?.();
        }}
      >
        {arrange ? (
          arrange({ name: nameInput, phone: phoneInput })
        ) : (
          <>
            {nameInput}
            {fields}
            {phoneInput}
          </>
        )}
        {/* Honeypot: hidden from people, filled by bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
          <label htmlFor={`website-${kind}`}>{t('honeypot')}</label>
          <input
            id={`website-${kind}`}
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <Checkbox
          label={contactConsentLabel}
          checked={contact}
          onCheckedChange={(v) => setContact(v === true)}
          error={errors.consent}
        />
        {marketingConsentLabel ? (
          <Checkbox
            label={marketingConsentLabel}
            checked={marketing}
            onCheckedChange={(v) => setMarketing(v === true)}
          />
        ) : null}
        {errors.form ? (
          <p role="alert" className="type-body-s text-danger">
            {errors.form}
          </p>
        ) : null}
        <Button type="submit" loading={busy} loadingLabel={t('sending')}>
          {submitLabel}
        </Button>
        {footer}
      </form>
    </Panel>
  );
}
