'use client';

import { Button, Callout, Checkbox, Input, Panel, PhoneFrame, formatBRL } from '@casvitta/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import { isPlanKey, limitOf } from '@/config/catalog';
import { formatPhoneBR } from '@/lib/format';
import { CrmError } from '@/lib/data/crm';
import {
  PAGE_THEMES,
  qrHref,
  usePage,
  usePlanUsage,
  usePublishPage,
  useUpdatePage,
  useUploadPagePhoto,
  type Page,
  type PageTheme,
} from '@/lib/data/page';
import {
  publish as publishListing,
  unpublish as unpublishListing,
  useProperties,
  usePropertyMutation,
  type PropertyOut,
} from '@/lib/data/properties';

import { CopyLink } from './CopyLink';
import { Storefront, type StorefrontData, type StorefrontProperty } from './Storefront';

/** Steps 2–9 of docs/mockups/social/10 (step 1, the account, is the email-link sign-up). */
export const ONBOARDING_STEPS = [2, 3, 4, 5, 6, 7, 8, 9] as const;
type Step = (typeof ONBOARDING_STEPS)[number];
const TOTAL = 9;
const LIVE_BIO = new Set(['published', 'pending_review']);

const isStep = (n: number): n is Step => (ONBOARDING_STEPS as readonly number[]).includes(n);
export const onBio = (p: PropertyOut) =>
  p.listings.some((l) => l.channel === 'bio_page' && LIVE_BIO.has(l.status));

/** The storefront as it will look, from the page and the properties chosen in step 5. */
export function previewData(page: Page, properties: PropertyOut[]): StorefrontData {
  const shown: StorefrontProperty[] = page.checklist.creci_verified
    ? properties.filter(onBio).map((p) => ({
        code: p.code,
        slug: p.slug,
        kind: p.kind,
        transaction: p.transaction,
        title: p.title,
        neighborhood: p.neighborhood,
        city: p.city,
        price_cents: p.price_cents,
        area_m2: p.area_m2,
        bedrooms: p.bedrooms,
        suites: p.suites,
        parking: p.parking,
        photos: p.media.map((m) => m.url),
      }))
    : [];
  return {
    slug: page.slug,
    theme: page.theme,
    display_name: page.display_name,
    works_as: page.works_as,
    agency_name: page.agency_name,
    photo_url: page.photo_url,
    bio: page.bio,
    regions: page.regions,
    whatsapp_e164: page.whatsapp_e164,
    creci: page.creci,
    creci_verified: page.checklist.creci_verified,
    branded: page.branded,
    properties: shown,
  };
}

/** SW1 · Onboarding: da conta à página publicada. No plan choice before the first publication. */
export function OnboardingScreen() {
  const t = useTranslations('social.onboarding');
  const router = useRouter();
  const params = useSearchParams();
  const page = usePage();
  const update = useUpdatePage();
  const requested = Number(params.get('passo'));
  const step: Step = isStep(requested) ? requested : clampStep(page.data?.onboarding_step);

  const go = (next: number) => {
    if (isStep(next)) {
      update.mutate({ onboarding_step: next });
      router.push(`/minha-pagina/comecar?passo=${next}`);
    }
  };
  const later = () =>
    update.mutate({ onboarding_dismissed: true }, { onSettled: () => router.push('/inicio') });

  if (page.isPending) {
    return (
      <p role="status" className="type-body text-fg-muted">
        {t('loading')}
      </p>
    );
  }
  if (page.isError || !page.data) {
    return (
      <Callout tone="attention" title={t('errorTitle')}>
        {t('error')}
      </Callout>
    );
  }
  const data = page.data;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        {!data.onboarding_done ? (
          <button
            type="button"
            onClick={later}
            className="hit-area-44 type-body-s text-fg-muted underline underline-offset-4"
          >
            {t('later')}
          </button>
        ) : null}
      </div>
      <Panel>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <ol aria-hidden="true" className="flex gap-1.5">
              {Array.from({ length: TOTAL }, (_, i) => (
                <li
                  key={i}
                  className={`h-1 flex-1 rounded-pill ${i < step ? 'bg-action' : 'bg-line'}`}
                />
              ))}
            </ol>
            <p className="font-mono type-caption">{t('progress', { n: step, total: TOTAL })}</p>
          </div>
          {step === 2 ? <WorkStep page={data} onDone={() => go(3)} /> : null}
          {step === 3 ? <ProfileStep page={data} onDone={() => go(4)} /> : null}
          {step === 4 ? <ThemeStep page={data} onDone={() => go(5)} /> : null}
          {step === 5 ? <PropertiesStep page={data} onDone={() => go(6)} /> : null}
          {step === 6 ? <PreviewStep page={data} onDone={() => go(7)} /> : null}
          {step === 7 ? <PublishedStep page={data} onDone={() => go(8)} /> : null}
          {step === 8 ? <QrStep onDone={() => go(9)} /> : null}
          {step === 9 ? (
            <ShareStep
              onDone={() =>
                update.mutate(
                  { onboarding_step: 9, onboarding_done: true },
                  { onSettled: () => router.push('/minha-pagina') },
                )
              }
            />
          ) : null}
          {step > 2 ? (
            <button
              type="button"
              onClick={() => router.push(`/minha-pagina/comecar?passo=${step - 1}`)}
              className="hit-area-44 self-start type-body-s text-fg-muted underline underline-offset-4"
            >
              {t('back')}
            </button>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function clampStep(n: number | undefined): Step {
  return n !== undefined && isStep(n) ? n : 2;
}

function StepTitle({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="type-display-l">{children}</h1>
      {intro ? <p className="type-body text-fg-strong">{intro}</p> : null}
    </div>
  );
}

function SaveError({ error }: { error: unknown }) {
  const t = useTranslations('social.onboarding');
  if (!error) return null;
  return (
    <p role="alert" className="type-body-s text-danger">
      {error instanceof CrmError && error.message ? error.message : t('saveError')}
    </p>
  );
}

// ------------------------------------------------------------------ 2 · Como você trabalha?

function WorkStep({ page, onDone }: { page: Page; onDone: () => void }) {
  const t = useTranslations('social.onboarding.work');
  const tOn = useTranslations('social.onboarding');
  const update = useUpdatePage();
  const [worksAs, setWorksAs] = useState(page.works_as);
  const [agency, setAgency] = useState(page.agency_name ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ works_as: worksAs, agency_name: agency }, { onSuccess: onDone });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <StepTitle>{t('title')}</StepTitle>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">{t('title')}</legend>
        {(['broker', 'agency'] as const).map((value) => (
          <label
            key={value}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-4 type-body has-focus-visible:outline-2 has-focus-visible:outline-focus ${
              worksAs === value ? 'border-action bg-action-subtle' : 'border-line bg-panel'
            }`}
          >
            <input
              type="radio"
              name="works_as"
              value={value}
              checked={worksAs === value}
              onChange={() => setWorksAs(value)}
              className="size-5 accent-(--color-action)"
            />
            {t(value)}
          </label>
        ))}
      </fieldset>
      {worksAs === 'agency' ? <Callout>{t('agencyNote')}</Callout> : null}
      <Input
        label={t('agencyName')}
        hint={t('optional')}
        help={t('agencyNameHelp')}
        value={agency}
        maxLength={120}
        onChange={(e) => setAgency(e.target.value)}
      />
      <SaveError error={update.error} />
      <Button type="submit" loading={update.isPending} loadingLabel={tOn('saving')}>
        {tOn('continue')}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ 3 · Dados profissionais

function ProfileStep({ page, onDone }: { page: Page; onDone: () => void }) {
  const t = useTranslations('social.onboarding.profile');
  const tOn = useTranslations('social.onboarding');
  const update = useUpdatePage();
  const upload = useUploadPagePhoto();
  const [name, setName] = useState(page.display_name);
  const [regions, setRegions] = useState(page.regions.join(', '));
  const [bio, setBio] = useState(page.bio ?? '');
  const [whatsapp, setWhatsapp] = useState(
    page.whatsapp_e164 ? formatPhoneBR(page.whatsapp_e164) : '',
  );
  const [missing, setMissing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) {
      setMissing(true);
      return;
    }
    update.mutate(
      {
        display_name: name,
        regions: regions
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
        bio,
        whatsapp,
      },
      { onSuccess: onDone },
    );
  };
  const initials = page.display_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <StepTitle>{t('title')}</StepTitle>
      <div className="flex items-center gap-4">
        {page.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- broker photo from storage
          <img
            src={page.photo_url}
            alt={t('photoAlt')}
            className="size-16 rounded-pill object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-pill bg-subtle font-display text-[22px] font-semibold text-fg-strong"
          >
            {initials}
          </span>
        )}
        <label className="inline-flex h-11 cursor-pointer items-center rounded-control border border-fg bg-panel px-4 type-body-s font-semibold has-focus-visible:outline-2 has-focus-visible:outline-focus">
          {upload.isPending
            ? t('photoUploading')
            : page.photo_url
              ? t('photoChange')
              : t('photoAdd')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
      </div>
      <SaveError error={upload.error} />
      <Input
        label={t('name')}
        required
        value={name}
        maxLength={160}
        error={missing && !name.trim() ? t('nameMissing') : undefined}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <p className="type-body-s font-medium text-fg">{t('creci')}</p>
        {page.creci ? (
          <p className="font-mono type-body">{page.creci}</p>
        ) : (
          <p className="type-body-s text-danger">{t('creciMissing')}</p>
        )}
        <p className="type-caption">
          {page.creci_status === 'verified' ? t('creciVerified') : t('creciPending')}{' '}
          <Link href="/configuracoes" className="underline underline-offset-4">
            {t('creciEdit')}
          </Link>
        </p>
      </div>
      <Input
        label={t('regions')}
        help={t('regionsHelp')}
        value={regions}
        onChange={(e) => setRegions(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="page-bio" className="type-body-s font-medium text-fg">
          {t('bio')} <span className="font-normal text-fg-muted">{t('optional')}</span>
        </label>
        <textarea
          id="page-bio"
          rows={3}
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          aria-describedby="page-bio-help"
          className="w-full rounded-control border border-line bg-panel px-3 py-2.5 type-body text-fg focus-visible:outline-2 focus-visible:outline-focus"
        />
        <p id="page-bio-help" className="type-caption">
          {t('bioHelp')}
        </p>
      </div>
      <Input
        label={t('whatsapp')}
        type="tel"
        inputMode="tel"
        required
        value={whatsapp}
        error={missing && !whatsapp.trim() ? t('whatsappMissing') : undefined}
        help={t('whatsappHelp')}
        onChange={(e) => setWhatsapp(e.target.value)}
      />
      <SaveError error={update.error} />
      <Button type="submit" loading={update.isPending} loadingLabel={tOn('saving')}>
        {tOn('continue')}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ 4 · Modelo visual

export function ThemePicker({
  value,
  onChange,
}: {
  value: PageTheme;
  onChange: (theme: PageTheme) => void;
}) {
  const t = useTranslations('social.themes');
  return (
    <fieldset className="grid grid-cols-3 gap-3">
      <legend className="sr-only">{t('legend')}</legend>
      {PAGE_THEMES.map((theme) => (
        <label
          key={theme}
          className="flex cursor-pointer flex-col items-center gap-2 has-focus-visible:outline-2 has-focus-visible:outline-focus"
        >
          <input
            type="radio"
            name="theme"
            value={theme}
            checked={value === theme}
            onChange={() => onChange(theme)}
            className="sr-only"
          />
          <span
            data-page-theme={theme}
            className={`flex h-28 w-full flex-col items-center justify-center gap-2 rounded-card border-2 bg-canvas ${
              value === theme ? 'border-action' : 'border-line'
            }`}
            aria-hidden="true"
          >
            <span className="size-8 rounded-pill bg-action" />
            <span className="h-1.5 w-12 rounded-pill bg-action" />
            <span className="h-4 w-16 rounded-pill bg-accent" />
          </span>
          <span className={`type-body-s ${value === theme ? 'font-semibold' : ''}`}>
            {t(theme)}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function ThemeStep({ page, onDone }: { page: Page; onDone: () => void }) {
  const t = useTranslations('social.onboarding.theme');
  const tOn = useTranslations('social.onboarding');
  const update = useUpdatePage();
  const [theme, setTheme] = useState<PageTheme>(page.theme);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ theme }, { onSuccess: onDone });
      }}
      className="flex flex-col gap-4"
    >
      <StepTitle>{t('title')}</StepTitle>
      <ThemePicker value={theme} onChange={setTheme} />
      <p className="type-caption">{t('note')}</p>
      <SaveError error={update.error} />
      <Button type="submit" loading={update.isPending} loadingLabel={tOn('saving')}>
        {tOn('continue')}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ 5 · Imóveis

function PropertiesStep({ page, onDone }: { page: Page; onDone: () => void }) {
  const t = useTranslations('social.onboarding.properties');
  const tOn = useTranslations('social.onboarding');
  const tBlockers = useTranslations('social.blockers');
  const properties = useProperties();
  const usage = usePlanUsage();
  const toPublish = usePropertyMutation(publishListing);
  const toUnpublish = usePropertyMutation(unpublishListing);
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const list = (properties.data ?? []).filter((p) => p.status === 'active' || p.status === 'draft');
  // Until the broker changes something, the selection is what is already on the page.
  const selected = chosen ?? new Set(list.filter(onBio).map((p) => p.id));

  const plan = usage.data?.plan;
  const limit = plan && isPlanKey(plan) ? limitOf(plan, 'active_properties') : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      for (const p of list) {
        const want = selected.has(p.id);
        if (want && !onBio(p)) await toPublish.mutateAsync([p.id, 'bio_page']);
        if (!want && onBio(p)) await toUnpublish.mutateAsync([p.id, 'bio_page']);
      }
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <StepTitle intro={list.length ? t('found', { n: list.length }) : t('none')}>
        {t('title')}
      </StepTitle>
      {properties.isPending ? (
        <p role="status" className="type-body-s text-fg-muted">
          {tOn('loading')}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {list.map((p) => {
          const blocked = p.blockers.filter((b) => b !== 'creci_unverified');
          const disabled = blocked.length > 0 && !onBio(p);
          return (
            <li key={p.id} className="rounded-control border border-line bg-panel p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected.has(p.id)}
                  disabled={disabled}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v === true) next.add(p.id);
                    else next.delete(p.id);
                    setChosen(next);
                  }}
                  label={
                    <span className="flex flex-col">
                      <span className="type-body-s font-semibold">
                        {p.title ?? `${p.neighborhood} · ${p.code}`}
                      </span>
                      <span className="font-mono type-caption">
                        {p.code} · {formatBRL(p.price_cents)}
                        {p.transaction === 'rent' ? t('perMonth') : ''}
                      </span>
                    </span>
                  }
                />
              </div>
              {disabled ? (
                <p className="mt-2 type-caption">
                  {t('blocked')} {blocked.map((b) => tBlockers(b)).join(' · ')}{' '}
                  <Link href={`/imoveis/${p.id}`} className="underline underline-offset-4">
                    {t('fix')}
                  </Link>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" asChild>
        <Link href="/imoveis/novo">{t('addManual')}</Link>
      </Button>
      {!page.checklist.creci_verified ? <p className="type-caption">{t('creciNote')}</p> : null}
      <p className="type-caption">
        {limit === null ? t('limitUnlimited') : t('limit', { n: limit })} {t('reviewNote')}
      </p>
      <SaveError error={error} />
      <Button type="submit" loading={busy} loadingLabel={tOn('saving')}>
        {tOn('continue')}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ 6 · Prévia

function PreviewStep({ page, onDone }: { page: Page; onDone: () => void }) {
  const t = useTranslations('social.onboarding.preview');
  const tOn = useTranslations('social.onboarding');
  const tBlockers = useTranslations('social.pageBlockers');
  const properties = useProperties();
  const publish = usePublishPage();
  return (
    <div className="flex flex-col gap-4">
      <StepTitle>{t('title')}</StepTitle>
      <PhoneFrame className="w-full max-w-[340px]">
        <div className="max-h-[560px] overflow-y-auto">
          <Storefront page={previewData(page, properties.data ?? [])} preview />
        </div>
      </PhoneFrame>
      {page.blockers.length ? (
        <Callout tone="attention" title={t('blockedTitle')}>
          {page.blockers.map((b) => tBlockers(b)).join(' ')}
        </Callout>
      ) : null}
      <SaveError error={publish.error} />
      <Button
        onClick={() => publish.mutate(true, { onSuccess: onDone })}
        loading={publish.isPending}
        loadingLabel={t('publishing')}
        disabled={page.blockers.length > 0}
      >
        {page.status === 'published' ? tOn('continue') : t('publish')}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ 7 · Publicada

function PublishedStep({ page, onDone }: { page: Page; onDone: () => void }) {
  const t = useTranslations('social.onboarding.published');
  const tOn = useTranslations('social.onboarding');
  const tPlans = useTranslations('plans');
  const usage = usePlanUsage();
  const plan = usage.data?.plan;
  return (
    <div className="flex flex-col gap-4">
      <StepTitle>{page.is_live ? t('title') : t('titleWaiting')}</StepTitle>
      <CopyLink url={page.url} />
      {!page.is_live ? <Callout tone="attention">{t('waitingCreci')}</Callout> : null}
      {plan && isPlanKey(plan) ? (
        <p className="type-body-s text-fg-strong">{t('plan', { plan: tPlans(`names.${plan}`) })}</p>
      ) : null}
      <Button onClick={onDone}>{tOn('continue')}</Button>
    </div>
  );
}

// ------------------------------------------------------------------ 8 · QR code

export function QrBlock() {
  const t = useTranslations('social.qr');
  return (
    <div className="flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated by the API per session */}
      <img
        src={qrHref('png')}
        alt={t('alt')}
        width={200}
        height={200}
        className="size-[200px] rounded-control border border-line bg-white p-2"
      />
      <div className="grid w-full gap-2 sm:grid-cols-2">
        <Button variant="secondary" asChild>
          <a href={qrHref('png')} download>
            {t('png')}
          </a>
        </Button>
        <Button variant="secondary" asChild>
          <a href={qrHref('pdf')} download>
            {t('pdf')}
          </a>
        </Button>
      </div>
      <p className="type-caption">{t('note')}</p>
    </div>
  );
}

function QrStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('social.onboarding.qr');
  const tOn = useTranslations('social.onboarding');
  return (
    <div className="flex flex-col gap-4">
      <StepTitle intro={t('intro')}>{t('title')}</StepTitle>
      <QrBlock />
      <Button onClick={onDone}>{tOn('continue')}</Button>
    </div>
  );
}

// ------------------------------------------------------------------ 9 · Divulgar

export function ShareHowTo() {
  const t = useTranslations('social.share');
  return (
    <dl className="flex flex-col divide-y divide-line border-y border-line">
      {(['instagram', 'tiktok', 'whatsapp'] as const).map((k) => (
        <div key={k} className="grid grid-cols-[96px_1fr] gap-3 py-3">
          <dt className="type-body-s font-semibold">{t(`${k}.name`)}</dt>
          <dd className="type-body-s text-fg-strong">{t(`${k}.how`)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ShareStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('social.onboarding.share');
  return (
    <div className="flex flex-col gap-4">
      <StepTitle>{t('title')}</StepTitle>
      <ShareHowTo />
      <Button onClick={onDone}>{t('done')}</Button>
    </div>
  );
}
