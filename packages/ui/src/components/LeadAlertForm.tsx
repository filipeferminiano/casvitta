'use client';

import { CircleCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { cn } from '../lib/cn.ts';
import { Button } from './Button.tsx';
import { Callout } from './Callout.tsx';
import { Checkbox } from './Checkbox.tsx';
import { Input } from './Input.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';

export type LeadAlertIntent = 'buy' | 'owner';

export type LeadAlertValues = {
  name: string;
  whatsapp: string;
  email: string;
  intent: LeadAlertIntent;
  consentContact: boolean;
  consentMarketing: boolean;
  /** Honeypot: people never see or fill it; bots do. */
  website: string;
};

export type LeadAlertResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Partial<Record<keyof LeadAlertValues, string>>; message?: string };

export type LeadAlertFormLabels = {
  title: string;
  description?: string;
  name: string;
  whatsapp: string;
  whatsappHelp?: string;
  email: string;
  emailOptional: string;
  intentLabel: string;
  intentBuy: string;
  intentOwner: string;
  consentContact: string;
  consentMarketing: string;
  consentRequired: string;
  /** Hidden label of the honeypot field. */
  honeypot: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
};

export type LeadAlertFormProps = {
  labels: LeadAlertFormLabels;
  defaultIntent?: LeadAlertIntent;
  showIntent?: boolean;
  onSubmit: (values: LeadAlertValues) => Promise<LeadAlertResult>;
  className?: string;
};

type Status = 'idle' | 'submitting' | 'success' | 'error';

/** "Avise-me": name, WhatsApp, optional email, intent and per-purpose consent (both unchecked). */
export function LeadAlertForm({
  labels,
  defaultIntent = 'buy',
  showIntent = true,
  onSubmit,
  className,
}: LeadAlertFormProps) {
  const [values, setValues] = useState<LeadAlertValues>({
    name: '',
    whatsapp: '',
    email: '',
    intent: defaultIntent,
    consentContact: false,
    consentMarketing: false,
    website: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LeadAlertValues, string>>>(
    {},
  );
  const [message, setMessage] = useState<string | undefined>();

  const set = <K extends keyof LeadAlertValues>(key: K, value: LeadAlertValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.consentContact) {
      setFieldErrors({ consentContact: labels.consentRequired });
      return;
    }
    setFieldErrors({});
    setMessage(undefined);
    setStatus('submitting');
    const result = await onSubmit(values);
    if (result.ok) {
      setStatus('success');
      return;
    }
    setFieldErrors(result.fieldErrors ?? {});
    setMessage(result.message);
    setStatus('error');
  }

  if (status === 'success') {
    return (
      <section
        className={cn('flex gap-3 rounded-card border border-line bg-panel p-4', className)}
        aria-live="polite"
      >
        <CircleCheck
          aria-hidden="true"
          strokeWidth={1.6}
          className="size-6 shrink-0 text-success"
        />
        <div className="flex flex-col gap-1">
          <h2 className="type-body font-semibold text-fg">{labels.successTitle}</h2>
          <p className="type-body-s text-fg-muted">{labels.successDescription}</p>
        </div>
      </section>
    );
  }

  const submitting = status === 'submitting';
  return (
    <section className={cn('relative rounded-card border border-line bg-panel p-4', className)}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="type-body font-semibold text-fg">{labels.title}</h2>
          {labels.description ? (
            <p className="type-body-s text-fg-muted">{labels.description}</p>
          ) : null}
        </div>
        {status === 'error' && message ? (
          <Callout tone="risk" title={labels.errorTitle}>
            <p>{message}</p>
          </Callout>
        ) : null}
        {showIntent ? (
          <div className="flex flex-col gap-1.5">
            <span className="type-body-s font-medium text-fg" aria-hidden="true">
              {labels.intentLabel}
            </span>
            <SegmentedControl
              label={labels.intentLabel}
              value={values.intent}
              onValueChange={(next) => set('intent', next as LeadAlertIntent)}
              options={[
                { value: 'buy', label: labels.intentBuy },
                { value: 'owner', label: labels.intentOwner },
              ]}
            />
          </div>
        ) : null}
        <Input
          label={labels.name}
          name="name"
          autoComplete="name"
          required
          value={values.name}
          error={fieldErrors.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Input
          label={labels.whatsapp}
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          help={labels.whatsappHelp}
          value={values.whatsapp}
          error={fieldErrors.whatsapp}
          onChange={(e) => set('whatsapp', e.target.value)}
        />
        <Input
          label={labels.email}
          hint={labels.emailOptional}
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={fieldErrors.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            {labels.honeypot}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-col">
          <Checkbox
            label={labels.consentContact}
            checked={values.consentContact}
            error={fieldErrors.consentContact}
            onCheckedChange={(checked) => set('consentContact', checked === true)}
          />
          <Checkbox
            label={labels.consentMarketing}
            checked={values.consentMarketing}
            onCheckedChange={(checked) => set('consentMarketing', checked === true)}
          />
        </div>
        <Button type="submit" loading={submitting} loadingLabel={labels.submitting}>
          {labels.submit}
        </Button>
      </form>
    </section>
  );
}
