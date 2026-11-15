'use client';

import { Button, Callout, Input } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { DemoBadge } from '@/components/badges';
import { MOCK_OTP, verifyOtp } from '@/lib/data/signup';
import { USE_MOCKS } from '@/mocks/clock';

const DIGITS = /\D/g;

export function toE164(raw: string): string | null {
  let digits = raw.replace(DIGITS, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? `+55${digits}` : null;
}

/**
 * "Conta": phone + one-time code. Used by /cadastro (with name) and /entrar (sign-in).
 * Mock mode accepts the demo code; real OTP over SMS comes with auth in Milestone 1.
 */
export function AccountStep({
  withName,
  submitLabel,
  onVerified,
}: {
  withName: boolean;
  submitLabel: string;
  onVerified: (result: { name: string; phoneE164: string }) => void;
}) {
  const t = useTranslations('signup.account');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; code?: string }>({});

  const sendCode = () => {
    const next: typeof errors = {};
    if (withName && name.trim().length < 2) next.name = t('nameError');
    if (!toE164(phone)) next.phone = t('phoneError');
    setErrors(next);
    if (Object.keys(next).length === 0) setSent(true);
  };

  const verify = () => {
    if (!verifyOtp(code)) {
      setErrors({ code: t('codeError') });
      return;
    }
    onVerified({ name: name.trim(), phoneE164: toE164(phone)! });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (sent) verify();
        else sendCode();
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
          disabled={sent}
        />
      ) : null}
      <Input
        label={t('phone')}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={t('phonePlaceholder')}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        help={t('phoneHelp')}
        error={errors.phone}
        disabled={sent}
      />
      {sent ? (
        <>
          <Input
            label={t('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            help={t('codeHelp')}
            error={errors.code}
            autoFocus
          />
          {USE_MOCKS ? (
            <Callout>
              <span className="flex flex-wrap items-center gap-2">
                <DemoBadge />
                {t('mockCode', { code: MOCK_OTP })}
              </span>
            </Callout>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit">{submitLabel}</Button>
            <Button type="button" variant="ghost" onClick={() => setSent(false)}>
              {t('changePhone')}
            </Button>
          </div>
        </>
      ) : (
        <Button type="submit" className="self-start">
          {t('sendCode')}
        </Button>
      )}
    </form>
  );
}
