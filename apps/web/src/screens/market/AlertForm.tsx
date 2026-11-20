'use client';

import { isApiError, type paths } from '@casvitta/api-client';
import { LeadAlertForm, type LeadAlertResult, type LeadAlertValues } from '@casvitta/ui';
import { useTranslations } from 'next-intl';

import { api } from '@/lib/api';
import { isLive } from '@/lib/live';

type AlertPayload =
  paths['/v1/public/property-alerts']['post']['requestBody']['content']['application/json'];

export type AlertScope =
  | { scope: 'neighborhood'; city: string; neighborhood: string }
  | { scope: 'street'; city: string; neighborhood: string; street: string }
  | { scope: 'building'; city: string; neighborhood: string; building: string };

const USE_API = isLive('market');
const FIELD_NAMES: Record<string, keyof LeadAlertValues> = {
  name: 'name',
  phone: 'whatsapp',
  email: 'email',
  'consents.contact_about_properties': 'consentContact',
};

/**
 * "Avise-me" / "Quanto vale o meu apartamento?" on price pages. Stores the alert with consent
 * per purpose (LGPD); no message is sent yet, and the success text does not promise one.
 */
export function AlertForm({
  target,
  defaultIntent = 'buy',
  showIntent = true,
  variant = 'default',
}: {
  target: AlertScope;
  defaultIntent?: 'buy' | 'owner';
  showIntent?: boolean;
  variant?: 'default' | 'building' | 'owner';
}) {
  const t = useTranslations('market.alert');

  async function submit(values: LeadAlertValues): Promise<LeadAlertResult> {
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
    };
    if (!USE_API) return { ok: true };
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
    <LeadAlertForm
      defaultIntent={defaultIntent}
      showIntent={showIntent}
      onSubmit={submit}
      labels={{
        title: t(`${variant}.title`),
        description: t(`${variant}.description`),
        name: t('name'),
        whatsapp: t('whatsapp'),
        whatsappHelp: t('whatsappHelp'),
        email: t('email'),
        emailOptional: t('emailOptional'),
        intentLabel: t('intentLabel'),
        intentBuy: t('intentBuy'),
        intentOwner: t('intentOwner'),
        consentContact: t('consentContact'),
        consentMarketing: t('consentMarketing'),
        consentRequired: t('consentRequired'),
        honeypot: t('honeypot'),
        submit: t(`${variant}.submit`),
        submitting: t('submitting'),
        successTitle: t('successTitle'),
        successDescription: t('successDescription'),
        errorTitle: t('errorTitle'),
      }}
    />
  );
}
