'use client';

import { Button, Callout, Input } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { DemoBadge } from '@/components/badges';
import { EMAIL, requestEmailLink } from '@/lib/data/signup';
import { isLive } from '@/lib/live';

const DIGITS = /\D/g;

export function toE164(raw: string): string | null {
  let digits = raw.replace(DIGITS, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? `+55${digits}` : null;
}

/**
 * "Conta": the email is the account. We email a link; opening it signs in (see /entrar/confirmar).
 * Used by /cadastro (with name) and /entrar. In demo mode no email is sent: a button stands in
 * for opening the link.
 */
export function AccountStep({
  intent,
  submitLabel,
  onDemoConfirmed,
}: {
  intent: 'sign_up' | 'sign_in';
  submitLabel: string;
  onDemoConfirmed: (result: { name: string; email: string }) => void;
}) {
  const t = useTranslations('signup.account');
  const withName = intent === 'sign_up';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; form?: string }>({});

  const send = async () => {
    const next: typeof errors = {};
    if (withName && name.trim().length < 2) next.name = t('nameError');
    if (!EMAIL.test(email.trim())) next.email = t('emailError');
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!isLive('accounts')) {
      setSent(true);
      return;
    }
    setBusy(true);
    const result = await requestEmailLink({
      intent,
      email: email.trim(),
      name: withName ? name.trim() : undefined,
    });
    setBusy(false);
    if (result.ok) setSent(true);
    else
      setErrors({
        name: result.fields.name,
        email: result.fields.email,
        form: result.message || t('sendError'),
      });
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="type-title">{t('sentTitle')}</p>
        <p className="type-body text-fg-strong">{t('sent', { email: email.trim() })}</p>
        {isLive('accounts') ? null : (
          <Callout>
            <span className="flex flex-col items-start gap-3">
              <span className="flex flex-wrap items-center gap-2">
                <DemoBadge />
                {t('demoNote')}
              </span>
              <Button
                type="button"
                onClick={() => onDemoConfirmed({ name: name.trim(), email: email.trim() })}
              >
                {t('demoOpen')}
              </Button>
            </span>
          </Callout>
        )}
        <div className="flex flex-wrap gap-3">
          {isLive('accounts') ? (
            <Button type="button" variant="secondary" loading={busy} onClick={() => void send()}>
              {t('resend')}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => setSent(false)}>
            {t('changeEmail')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      noValidate
    >
      {withName ? (
        <Input
          label={t('name')}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
      ) : null}
      <Input
        label={t('email')}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={t('emailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        help={t('emailHelp')}
        error={errors.email}
      />
      {errors.form ? <p className="type-body-s text-danger">{errors.form}</p> : null}
      <Button type="submit" className="self-start" loading={busy} loadingLabel={t('sending')}>
        {submitLabel}
      </Button>
    </form>
  );
}
