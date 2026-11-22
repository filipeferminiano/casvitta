'use client';

import { Button, Callout, Checkbox, Input, Panel } from '@casvitta/ui';
import { Textarea } from '@casvitta/ui/backoffice';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { api } from '@/lib/api';

/** "Falar sobre este imóvel": lands in the broker's CRM with the consent text as proof. */
export function LiveListingContactForm({
  slug,
  code,
  pageUrl,
}: {
  slug: string;
  code: string;
  pageUrl: string;
}) {
  const t = useTranslations('liveListing');
  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    message: t('messageDefault', { code }),
    whatsapp: false,
    mail: false,
  });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.phone && !f.email) return setError(t('needReach'));
    if (!f.whatsapp && !f.mail) return setError(t('needConsent'));
    setState('sending');
    setError(null);
    const consentText = [
      f.whatsapp ? t('consentWhatsapp') : null,
      f.mail ? t('consentEmail') : null,
    ]
      .filter(Boolean)
      .join(' ');
    const params = new URLSearchParams(window.location.search);
    const { error: failure } = await api.POST('/v1/public/listings/{slug}/contact', {
      params: { path: { slug } },
      body: {
        name: f.name,
        phone: f.phone || null,
        email: f.email || null,
        message: f.message,
        consent_whatsapp: f.whatsapp && Boolean(f.phone),
        consent_email: f.mail && Boolean(f.email),
        consent_text: `${consentText} ${t('consentNote')}`,
        page_url: pageUrl,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
      },
    });
    if (failure) {
      const message = (failure as { error?: { message?: string } }).error?.message;
      setError(message || t('error'));
      setState('idle');
      return;
    }
    setState('sent');
  };

  if (state === 'sent') {
    return (
      <Panel title={t('contactTitle')}>
        <Callout tone="info">{t('sent')}</Callout>
      </Panel>
    );
  }
  return (
    <Panel title={t('contactTitle')}>
      <p className="mb-3 type-body-s text-fg-muted">{t('contactIntro')}</p>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Input
          label={t('name')}
          required
          autoComplete="name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <Input
          label={t('phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
        />
        <Input
          label={t('email')}
          type="email"
          autoComplete="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <Textarea
          label={t('message')}
          required
          maxLength={2000}
          value={f.message}
          onChange={(e) => setF({ ...f, message: e.target.value })}
        />
        <Checkbox
          checked={f.whatsapp}
          onCheckedChange={(v) => setF({ ...f, whatsapp: v === true })}
          label={t('consentWhatsapp')}
        />
        <Checkbox
          checked={f.mail}
          onCheckedChange={(v) => setF({ ...f, mail: v === true })}
          label={t('consentEmail')}
        />
        <p className="type-caption">{t('consentNote')}</p>
        {error ? <p className="type-body-s text-danger">{error}</p> : null}
        <Button type="submit" loading={state === 'sending'} loadingLabel={t('sending')}>
          {t('send')}
        </Button>
      </form>
    </Panel>
  );
}
