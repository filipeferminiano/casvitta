'use client';

import { isApiError, type paths } from '@casvitta/api-client';
import { LeadAlertForm, type LeadAlertResult, type LeadAlertValues } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { api } from '@/lib/api';

type AlertPayload =
  paths['/v1/public/property-alerts']['post']['requestBody']['content']['application/json'];
export type AlertIntent = AlertPayload['intent'];

export type AlertScope =
  | { scope: 'city'; city: string }
  | { scope: 'neighborhood'; city: string; neighborhood: string }
  | { scope: 'street'; city: string; neighborhood: string; street: string }
  | { scope: 'building'; city: string; neighborhood: string; building: string };

/** Copy variants in market.alert.{variant}: title, description, submit. */
export type AlertVariant =
  | 'neighborhood'
  | 'street'
  | 'building'
  | 'financing'
  | 'valuation'
  | 'outsideCoverage'
  | 'itbi'
  | 'listingsRent'
  | 'listingsSale';

const FIELD_NAMES: Record<string, string> = {
  name: 'name',
  phone: 'whatsapp',
  email: 'email',
  'consents.contact_about_properties': 'consentContact',
};

/**
 * Lead form on price pages and tools. Always posts to the API (also when the page shows demo
 * price data): a lead is never reported as saved unless the API stored it. Consent per purpose
 * (LGPD); no message is sent yet, and the success copy does not promise one.
 */
export function AlertForm({
  target,
  intents,
  variant,
  titleValues,
  chips,
  budget = false,
  valuationSnapshot,
}: {
  target: AlertScope;
  /** Intents offered, default first. */
  intents: AlertIntent[];
  variant: AlertVariant;
  titleValues?: Record<string, string>;
  chips?: ReactNode[];
  /** Financing page: an optional budget field. */
  budget?: boolean;
  valuationSnapshot?: Record<string, unknown>;
}) {
  const t = useTranslations('market.alert');

  async function submit(
    values: LeadAlertValues<AlertIntent>,
  ): Promise<LeadAlertResult<AlertIntent>> {
    const payload: AlertPayload = {
      ...target,
      intent: values.intent,
      name: values.name,
      phone: values.whatsapp,
      email: values.email || null,
      consents: {
        contact_about_properties: values.consentContact,
        marketing: values.consentMarketing,
      },
      source_page: window.location.pathname,
      website: values.website || null,
      valuation_snapshot:
        valuationSnapshot ?? (values.extra != null ? { budget_cents: values.extra } : null),
    };
    const { data, error } = await api.POST('/v1/public/property-alerts', { body: payload });
    if (data) return { ok: true };
    if (isApiError(error)) {
      const fieldErrors: Record<string, string> = {};
      for (const field of error.error.fields ?? []) {
        const name = FIELD_NAMES[field.path.filter((p) => p !== 'body').join('.')];
        if (name) fieldErrors[name] = field.message;
      }
      return { ok: false, message: error.error.message, fieldErrors };
    }
    return { ok: false, message: t('genericError') };
  }

  return (
    <LeadAlertForm<AlertIntent>
      intents={intents.map((value) => ({ value, label: t(`intents.${value}`) }))}
      defaultIntent={intents[0]}
      showIntent={intents.length > 1}
      chips={chips}
      extraField={
        budget
          ? { name: 'budget', label: t('budget'), kind: 'currency', help: t('budgetHelp') }
          : undefined
      }
      onSubmit={submit}
      labels={{
        title: t(`${variant}.title`, titleValues ?? {}),
        description: t(`${variant}.description`, titleValues ?? {}),
        name: t('name'),
        whatsapp: t('whatsapp'),
        whatsappHelp: t('whatsappHelp'),
        email: t('email'),
        emailOptional: t('emailOptional'),
        intentLabel: t('intentLabel'),
        consentContact: t('consentContact'),
        consentMarketing: t('consentMarketing'),
        consentRequired: t('consentRequired'),
        honeypot: t('honeypot'),
        submit: t(`${variant}.submit`),
        submitting: t('submitting'),
        successTitle: t('successTitle'),
        successDescription: t('successDescription'),
        errorTitle: t('errorTitle'),
        privacyLine: t('privacyLine'),
      }}
    />
  );
}
