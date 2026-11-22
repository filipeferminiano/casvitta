'use client';

import { Button, Checkbox, Input, Select, cn } from '@casvitta/ui';
import { Textarea } from '@casvitta/ui/backoffice';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import {
  sourceFromSearch,
  submitPageInquiry,
  type PageInquiry,
  type PropertyKind,
} from '@/lib/data/page';

import type { StorefrontData, StorefrontProperty } from './Storefront';

type Purpose = 'buy' | 'rent';
type Kind = 'apartment' | 'house';

export type FinderAnswers = {
  purpose: Purpose | null;
  neighborhoods: string[];
  budget: number | null; // index into BUDGETS[purpose]
  minBedrooms: number | null; // null = tanto faz
  kinds: Kind[]; // empty = tanto faz
};

const K = 100_000; // R$ 1 mil, in cents
const M = 1000 * K; // R$ 1 milhão
/** Budget ranges in cents [min, max]; null = open. Sale from mockup social/03. */
export const BUDGETS: Record<Purpose, Array<[number | null, number | null]>> = {
  buy: [
    [null, 600 * K],
    [600 * K, 900 * K],
    [900 * K, 1.5 * M],
    [1.5 * M, null],
  ],
  rent: [
    [null, 2 * K],
    [2 * K, 3.5 * K],
    [3.5 * K, 6 * K],
    [6 * K, null],
  ],
};

/** Properties of this page that match the answers (nothing leaves the browser for this). */
export function matchProperties(
  properties: StorefrontProperty[],
  a: FinderAnswers,
): StorefrontProperty[] {
  const range = a.purpose && a.budget != null ? BUDGETS[a.purpose][a.budget] : null;
  return properties.filter((p) => {
    if (a.purpose && p.transaction !== (a.purpose === 'buy' ? 'sale' : 'rent')) return false;
    if (a.neighborhoods.length && !a.neighborhoods.includes(p.neighborhood)) return false;
    if (range) {
      const [low, high] = range;
      if (low != null && p.price_cents < low) return false;
      if (high != null && p.price_cents > high) return false;
    }
    if (a.minBedrooms != null && (p.bedrooms ?? 0) < a.minBedrooms) return false;
    if (a.kinds.length && !a.kinds.includes(p.kind as Kind)) return false;
    return true;
  });
}

/** One question per screen (finder) or a short form (owner), in place of the page content. */
function Flow({
  title,
  onBack,
  backLabel,
  children,
}: {
  title: ReactNode;
  onBack: () => void;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="page-flow-title" className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="hit-area-44 inline-flex w-fit items-center gap-2 rounded-control type-body-s font-medium text-fg-strong focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </button>
      <h2 id="page-flow-title" className="type-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Option({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center rounded-card border px-4 text-left type-body font-medium',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        pressed ? 'border-accent bg-accent-subtle text-fg' : 'border-line bg-panel text-fg',
      )}
    >
      {children}
    </button>
  );
}

type Contact = { name: string; phone: string; email: string; consent: boolean };

/** Name, WhatsApp, optional e-mail and the consent (unchecked, required). */
function ContactStep({
  page,
  needPhone,
  submitLabel,
  onSubmit,
}: {
  page: StorefrontData;
  needPhone: boolean;
  submitLabel: string;
  onSubmit: (c: Contact, consentText: string) => Promise<string | null>;
}) {
  const t = useTranslations('social.forms');
  const firstName = page.display_name.split(' ')[0] ?? page.display_name;
  const [c, setC] = useState<Contact>({ name: '', phone: '', email: '', consent: false });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const consentText = t('consent', { name: firstName });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (c.name.trim().length < 2) return setError(t('needName'));
    if (needPhone && !c.phone.trim()) return setError(t('needPhone'));
    if (!c.phone.trim() && !c.email.trim()) return setError(t('needReach'));
    if (!c.consent) return setError(t('needConsent'));
    setSending(true);
    setError(null);
    const failure = await onSubmit(c, consentText);
    setSending(false);
    if (failure) setError(failure);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Input
        label={t('name')}
        required
        autoComplete="name"
        value={c.name}
        onChange={(e) => setC({ ...c, name: e.target.value })}
      />
      <Input
        label={t('whatsapp')}
        required={needPhone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(19) 98123-4567"
        value={c.phone}
        onChange={(e) => setC({ ...c, phone: e.target.value })}
      />
      <Input
        label={t('email')}
        hint={needPhone ? t('optional') : undefined}
        type="email"
        autoComplete="email"
        value={c.email}
        onChange={(e) => setC({ ...c, email: e.target.value })}
      />
      <Checkbox
        checked={c.consent}
        onCheckedChange={(v) => setC({ ...c, consent: v === true })}
        label={consentText}
      />
      {error ? (
        <p role="alert" className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={sending} loadingLabel={t('sending')} className="h-12">
        {submitLabel}
      </Button>
      <p className="type-caption">{t('noDocuments')}</p>
    </form>
  );
}

function useSubmit(page: StorefrontData) {
  const t = useTranslations('social.forms');
  return async (body: Omit<PageInquiry, 'page_url' | 'source' | 'utm_source'>) => {
    const params = new URLSearchParams(window.location.search);
    try {
      await submitPageInquiry(page.slug, {
        ...body,
        page_url: window.location.origin + window.location.pathname,
        source: sourceFromSearch(params),
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
      });
      return null;
    } catch (e) {
      return (e as Error).message || t('error');
    }
  };
}

function Done({
  title,
  text,
  action,
  onDone,
}: {
  title: string;
  text: string;
  action: string;
  onDone: () => void;
}) {
  return (
    <div role="status" className="flex flex-col gap-4 rounded-card border border-line bg-panel p-5">
      <h3 className="type-title">{title}</h3>
      <p className="type-body text-fg-strong">{text}</p>
      <Button variant="secondary" className="h-12" onClick={onDone}>
        {action}
      </Button>
    </div>
  );
}

/** "Encontre um imóvel para mim" (mockup social/03): 5 questions → matches → optional help. */
export function Finder({
  page,
  onClose,
  renderProperty,
}: {
  page: StorefrontData;
  onClose: () => void;
  renderProperty: (p: StorefrontProperty) => ReactNode;
}) {
  const t = useTranslations('social.forms');
  const tKinds = useTranslations('crm.properties.kinds');
  const firstName = page.display_name.split(' ')[0] ?? page.display_name;
  const submit = useSubmit(page);
  const [step, setStep] = useState(1);
  const [a, setA] = useState<FinderAnswers>({
    purpose: null,
    neighborhoods: [],
    budget: null,
    minBedrooms: null,
    kinds: [],
  });
  const places = [
    ...new Set([...page.properties.map((p) => p.neighborhood), ...page.regions]),
  ].filter(Boolean);
  const back = () => (step === 1 ? onClose() : setStep(step - 1));
  const next = () => setStep(step + 1);
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  if (step === 8) {
    return (
      <Done
        title={t('finder.sentTitle')}
        text={t('finder.sentText', { name: firstName })}
        action={t('keepBrowsing')}
        onDone={onClose}
      />
    );
  }

  const matches = matchProperties(page.properties, a);
  const purpose = a.purpose ?? 'buy';
  const question = (key: string, body: ReactNode, canGo = true) => (
    <Flow
      title={
        <>
          <span className="block type-caption font-semibold text-fg-muted">
            {t('finder.stepOf', { step, total: 5 })}
          </span>
          {t(`finder.q${key}`)}
        </>
      }
      onBack={back}
      backLabel={step === 1 ? t('backToPage') : t('back')}
    >
      {body}
      <Button className="h-12" disabled={!canGo} onClick={next}>
        {step === 5 ? t('finder.seeMatches') : t('continue')}
      </Button>
    </Flow>
  );

  if (step === 1)
    return question(
      '1',
      <div className="flex flex-col gap-2">
        {(['buy', 'rent'] as const).map((p) => (
          <Option
            key={p}
            pressed={a.purpose === p}
            onClick={() => setA({ ...a, purpose: p, budget: null })}
          >
            {t(`finder.purpose.${p}`)}
          </Option>
        ))}
      </div>,
      a.purpose != null,
    );
  if (step === 2)
    return question(
      '2',
      <div className="flex flex-col gap-2">
        <p className="type-body-s text-fg-muted">{t('finder.manyAllowed')}</p>
        {places.map((n) => (
          <Option
            key={n}
            pressed={a.neighborhoods.includes(n)}
            onClick={() => setA({ ...a, neighborhoods: toggle(a.neighborhoods, n) })}
          >
            {n}
          </Option>
        ))}
        <Option
          pressed={a.neighborhoods.length === 0}
          onClick={() => setA({ ...a, neighborhoods: [] })}
        >
          {t('finder.anyPlace')}
        </Option>
      </div>,
    );
  if (step === 3)
    return question(
      purpose === 'buy' ? '3buy' : '3rent',
      <div className="flex flex-col gap-2">
        {BUDGETS[purpose].map((_, i) => (
          <Option key={i} pressed={a.budget === i} onClick={() => setA({ ...a, budget: i })}>
            {t(`finder.budget.${purpose}.${i}`)}
          </Option>
        ))}
        <Option pressed={a.budget === null} onClick={() => setA({ ...a, budget: null })}>
          {t('finder.notSure')}
        </Option>
      </div>,
    );
  if (step === 4)
    return question(
      '4',
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((n) => (
          <Option
            key={n}
            pressed={a.minBedrooms === n}
            onClick={() => setA({ ...a, minBedrooms: n })}
          >
            {t('finder.bedrooms', { n })}
          </Option>
        ))}
        <Option pressed={a.minBedrooms === null} onClick={() => setA({ ...a, minBedrooms: null })}>
          {t('finder.whatever')}
        </Option>
      </div>,
    );
  if (step === 5)
    return question(
      '5',
      <div className="flex flex-col gap-2">
        {(['apartment', 'house'] as const).map((k) => (
          <Option
            key={k}
            pressed={a.kinds.includes(k)}
            onClick={() => setA({ ...a, kinds: toggle(a.kinds, k) })}
          >
            {tKinds(k)}
          </Option>
        ))}
        <Option pressed={a.kinds.length === 0} onClick={() => setA({ ...a, kinds: [] })}>
          {t('finder.whatever')}
        </Option>
      </div>,
    );

  const summary = [
    t(`finder.purpose.${purpose}`),
    a.neighborhoods.join(', ') || null,
    a.budget != null ? t(`finder.budget.${purpose}.${a.budget}`) : null,
    a.minBedrooms != null ? t('finder.bedrooms', { n: a.minBedrooms }) : null,
    a.kinds.length ? a.kinds.map((k) => tKinds(k)).join(', ') : null,
  ].filter(Boolean);

  if (step === 6) {
    return (
      <Flow title={t('finder.matches', { n: matches.length })} onBack={back} backLabel={t('back')}>
        <p className="type-body-s text-fg-muted">{summary.join(' · ')}</p>
        {matches.length ? (
          <ul className="flex flex-col gap-5">
            {matches.map((p) => (
              <li key={p.code}>{renderProperty(p)}</li>
            ))}
          </ul>
        ) : (
          <p className="rounded-card border border-line bg-panel p-4 type-body-s text-fg-strong">
            {t('finder.noMatches', { name: firstName })}
          </p>
        )}
        {page.forms ? (
          <div className="flex flex-col gap-3 rounded-card bg-accent-subtle p-5">
            <h3 className="type-title text-accent">{t('finder.helpTitle', { name: firstName })}</h3>
            <p className="type-body-s text-fg-strong">
              {t('finder.helpText', { name: firstName })}
            </p>
            <Button className="h-12" onClick={next}>
              {t('finder.helpAction', { name: firstName })}
            </Button>
          </div>
        ) : null}
      </Flow>
    );
  }

  const [low, high] = (a.budget != null ? BUDGETS[purpose][a.budget] : undefined) ?? [null, null];
  return (
    <Flow title={t('finder.contactTitle', { name: firstName })} onBack={back} backLabel={t('back')}>
      <ContactStep
        page={page}
        needPhone
        submitLabel={t('send')}
        onSubmit={(c, consentText) =>
          submit({
            kind: 'finder',
            purpose,
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
            consent: c.consent,
            consent_text: consentText,
            neighborhoods: a.neighborhoods,
            property_kinds: a.kinds,
            min_price_cents: low,
            max_price_cents: high,
            min_bedrooms: a.minBedrooms,
            matched_codes: matches.map((p) => p.code),
            contact_preference: 'whatsapp',
          }).then((failure) => {
            if (!failure) setStep(8);
            return failure;
          })
        }
      />
    </Flow>
  );
}

/** "Quero vender ou alugar meu imóvel" (mockup social/03). No formal valuation is promised. */
export function OwnerForm({ page, onClose }: { page: StorefrontData; onClose: () => void }) {
  const t = useTranslations('social.forms');
  const tKinds = useTranslations('crm.properties.kinds');
  const firstName = page.display_name.split(' ')[0] ?? page.display_name;
  const submit = useSubmit(page);
  const [done, setDone] = useState(false);
  const [o, setO] = useState({
    purpose: 'sell' as 'sell' | 'let',
    city: page.properties[0]?.city ?? '',
    neighborhood: '',
    kind: 'apartment',
    details: '',
    preference: 'whatsapp' as 'whatsapp' | 'call' | 'email',
  });
  const [cityError, setCityError] = useState<string | null>(null);

  if (done) {
    return (
      <Done
        title={t('owner.sentTitle')}
        text={t('owner.sentText', { name: firstName })}
        action={t('keepBrowsing')}
        onDone={onClose}
      />
    );
  }
  return (
    <Flow title={t('owner.title')} onBack={onClose} backLabel={t('backToPage')}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 type-body-s font-medium">{t('owner.service')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['sell', 'let'] as const).map((p) => (
            <Option key={p} pressed={o.purpose === p} onClick={() => setO({ ...o, purpose: p })}>
              {t(`owner.purpose.${p}`)}
            </Option>
          ))}
        </div>
      </fieldset>
      <Input
        label={t('owner.city')}
        required
        autoComplete="address-level2"
        value={o.city}
        error={cityError ?? undefined}
        onChange={(e) => setO({ ...o, city: e.target.value })}
      />
      <Input
        label={t('owner.neighborhood')}
        hint={t('optional')}
        value={o.neighborhood}
        onChange={(e) => setO({ ...o, neighborhood: e.target.value })}
      />
      <Select
        label={t('owner.kind')}
        value={o.kind}
        onValueChange={(kind) => setO({ ...o, kind })}
        options={(['apartment', 'house', 'studio', 'commercial', 'land'] as const).map((k) => ({
          value: k,
          label: tKinds(k),
        }))}
      />
      <Textarea
        label={`${t('owner.details')} ${t('optional')}`}
        placeholder={t('owner.detailsPlaceholder')}
        maxLength={1000}
        value={o.details}
        onChange={(e) => setO({ ...o, details: e.target.value })}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 type-body-s font-medium">{t('owner.preference')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['whatsapp', 'call', 'email'] as const).map((p) => (
            <Option
              key={p}
              pressed={o.preference === p}
              onClick={() => setO({ ...o, preference: p })}
            >
              {t(`owner.preferences.${p}`)}
            </Option>
          ))}
        </div>
      </fieldset>
      <ContactStep
        page={page}
        needPhone={o.preference !== 'email'}
        submitLabel={t('owner.send')}
        onSubmit={async (c, consentText) => {
          if (!o.city.trim()) {
            setCityError(t('owner.needCity'));
            return t('owner.needCity');
          }
          setCityError(null);
          if (o.preference === 'email' && !c.email.trim()) return t('owner.needEmail');
          const failure = await submit({
            kind: 'owner',
            purpose: o.purpose,
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
            consent: c.consent,
            consent_text: consentText,
            city: o.city,
            neighborhoods: o.neighborhood ? [o.neighborhood] : [],
            property_kinds: [o.kind as PropertyKind],
            details: o.details || null,
            contact_preference: o.preference,
          });
          if (!failure) setDone(true);
          return failure;
        }}
      />
    </Flow>
  );
}
