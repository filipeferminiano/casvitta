'use client';

import { CircleCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { Button } from './Button.tsx';
import { Callout } from './Callout.tsx';
import { Checkbox } from './Checkbox.tsx';
import { CurrencyInput } from './CurrencyInput.tsx';
import { Input } from './Input.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';

/** Default intents (SEO-1 pages). Pages pass their own list through `intents`. */
export type LeadAlertIntent = 'buy' | 'owner';

export type LeadAlertIntentOption<I extends string = LeadAlertIntent> = { value: I; label: string };

export type LeadAlertExtraField = {
  name: string;
  label: string;
  kind: 'currency';
  help?: string;
};

export type LeadAlertValues<I extends string = LeadAlertIntent> = {
  name: string;
  whatsapp: string;
  email: string;
  intent: I;
  /** Value of `extraField` (integer cents for 'currency'), or null when empty/absent. */
  extra: number | null;
  consentContact: boolean;
  consentMarketing: boolean;
  /** Honeypot: people never see or fill it; bots do. */
  website: string;
};

export type LeadAlertResult<I extends string = LeadAlertIntent> =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: Partial<Record<keyof LeadAlertValues<I>, string>>;
      message?: string;
    };

export type LeadAlertFormLabels = {
  title: string;
  description?: string;
  name: string;
  whatsapp: string;
  whatsappHelp?: string;
  email: string;
  emailOptional: string;
  intentLabel: string;
  /** Labels of the default intents; not needed when `intents` is passed. */
  intentBuy?: string;
  intentOwner?: string;
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
  /** "Usamos seus dados só para este contato, conforme a LGPD." */
  privacyLine?: ReactNode;
};

export type LeadAlertFormProps<I extends string = LeadAlertIntent> = {
  labels: LeadAlertFormLabels;
  /** Intents for this page, default first. Without it: buy / owner from the labels. */
  intents?: LeadAlertIntentOption<I>[];
  /** Overrides the first intent as the initial choice. */
  defaultIntent?: I;
  showIntent?: boolean;
  /** Context shown above the fields, e.g. the current filters on listing pages. */
  chips?: ReactNode[];
  /** One optional extra field, e.g. the budget on the financing page. */
  extraField?: LeadAlertExtraField;
  onSubmit: (values: LeadAlertValues<I>) => Promise<LeadAlertResult<I>>;
  className?: string;
};

type Status = 'idle' | 'submitting' | 'success' | 'error';

/** "Avise-me": name, WhatsApp, optional email, intent and per-purpose consent (both unchecked). */
export function LeadAlertForm<I extends string = LeadAlertIntent>({
  labels,
  intents,
  defaultIntent,
  showIntent = true,
  chips,
  extraField,
  onSubmit,
  className,
}: LeadAlertFormProps<I>) {
  const options: LeadAlertIntentOption<I>[] =
    intents ??
    ([
      { value: 'buy', label: labels.intentBuy ?? 'buy' },
      { value: 'owner', label: labels.intentOwner ?? 'owner' },
    ] as LeadAlertIntentOption<I>[]);
  const [values, setValues] = useState<LeadAlertValues<I>>({
    name: '',
    whatsapp: '',
    email: '',
    intent: defaultIntent ?? (options[0]?.value as I),
    extra: null,
    consentContact: false,
    consentMarketing: false,
    website: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LeadAlertValues<I>, string>>>(
    {},
  );
  const [message, setMessage] = useState<string | undefined>();

  const set = <K extends keyof LeadAlertValues<I>>(key: K, value: LeadAlertValues<I>[K]) =>
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
        {chips?.length ? (
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip, index) => (
              <li key={index}>{chip}</li>
            ))}
          </ul>
        ) : null}
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
              onValueChange={(next) => set('intent', next as I)}
              options={options}
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
        {extraField ? (
          <CurrencyInput
            label={extraField.label}
            name={extraField.name}
            help={extraField.help}
            value={values.extra}
            error={fieldErrors.extra}
            onValueChange={(cents) => set('extra', cents)}
          />
        ) : null}
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
        {labels.privacyLine ? <p className="type-caption">{labels.privacyLine}</p> : null}
      </form>
    </section>
  );
}
