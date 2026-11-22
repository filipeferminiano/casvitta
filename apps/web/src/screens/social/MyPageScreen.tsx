'use client';

import { Button, Callout, Input, Panel, StatTile, Switch } from '@casvitta/ui';
import { Check, Circle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { CrmError } from '@/lib/data/crm';
import {
  checkPageSlug,
  useChangePageSlug,
  usePage,
  usePageStats,
  usePublishPage,
  useUpdatePage,
  type Page,
  type SlugCheck,
} from '@/lib/data/page';
import { formatNumber } from '@/lib/format';

import { CollectionsPanel } from './CollectionsEditor';
import { CopyLink } from './CopyLink';
import { DomainPanel } from './DomainPanel';
import { QrBlock, ShareHowTo, ThemePicker } from './OnboardingScreen';

const CHECKLIST = [
  'published',
  'creci_verified',
  'profile_photo',
  'bio',
  'has_properties',
  'link_used',
] as const;

/** Minha página · Visão geral (docs/mockups/social/11, SOC-1a scope). */
export function MyPageScreen() {
  const t = useTranslations('social.myPage');
  const page = usePage();

  if (page.isPending) {
    return (
      <p role="status" className="type-body text-fg-muted">
        {t('loading')}
      </p>
    );
  }
  if (page.isError || !page.data) {
    return <Callout tone="attention">{t('error')}</Callout>;
  }
  const data = page.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          !data.onboarding_done ? (
            <Button asChild>
              <Link href="/minha-pagina/comecar">{t('continueSetup')}</Link>
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <a href={data.url} target="_blank" rel="noopener noreferrer">
                {t('open')}
              </a>
            </Button>
          )
        }
      />
      {data.status === 'suspended' ? (
        <Callout tone="risk" title={t('suspendedTitle')}>
          {data.suspended_reason ?? t('suspended')}
        </Callout>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <AddressPanel page={data} />
          <DomainPanel page={data} />
          <StatsPanel forms={data.forms} />
          <AppearancePanel page={data} />
          <CollectionsPanel />
        </div>
        <div className="flex flex-col gap-6">
          <ChecklistPanel page={data} />
          <Panel title={t('qrTitle')}>
            <QrBlock />
          </Panel>
          <Panel title={t('shareTitle')}>
            <ShareHowTo />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AddressPanel({ page }: { page: Page }) {
  const t = useTranslations('social.myPage');
  const publish = usePublishPage();
  const on = page.status === 'published';
  return (
    <Panel title={t('addressTitle')}>
      <div className="flex flex-col gap-4">
        <CopyLink url={page.url} />
        <ChangeAddress page={page} />
        <Switch
          checked={on}
          disabled={
            publish.isPending || page.status === 'suspended' || (!on && page.blockers.length > 0)
          }
          onCheckedChange={(v) => publish.mutate(v)}
          label={on ? t('switchOn') : t('switchOff')}
        />
        {on && !page.is_live ? <Callout tone="attention">{t('waitingCreci')}</Callout> : null}
        {!on && page.blockers.length ? (
          <p className="type-body-s text-fg-muted">{t('blocked')}</p>
        ) : null}
        {publish.error ? (
          <p role="alert" className="type-body-s text-danger">
            {publish.error instanceof CrmError && publish.error.message
              ? publish.error.message
              : t('saveError')}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function StatsPanel({ forms }: { forms: boolean }) {
  const t = useTranslations('social.myPage.stats');
  const stats = usePageStats(30);
  const s = stats.data;
  return (
    <Panel title={t('title')}>
      <div
        className={forms ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-3 sm:grid-cols-3'}
      >
        <StatTile label={t('views')} value={s ? formatNumber(s.page_views) : '…'} highlighted />
        <StatTile label={t('propertyViews')} value={s ? formatNumber(s.property_views) : '…'} />
        <StatTile label={t('whatsapp')} value={s ? formatNumber(s.whatsapp_clicks) : '…'} />
        {forms ? (
          <StatTile label={t('forms')} value={s ? formatNumber(s.forms_submitted) : '…'} />
        ) : null}
      </div>
      {s ? (
        <p className="mt-3 type-body-s text-fg-strong">
          {t('bySource', {
            link: s.by_source.link ?? 0,
            qr: s.by_source.qr ?? 0,
            campaign: s.by_source.campaign ?? 0,
          })}
        </p>
      ) : null}
      <p className="mt-2 type-caption">{t('note')}</p>
      {forms ? (
        <Link
          href="/contatos?visao=page"
          className="mt-3 inline-flex min-h-11 items-center type-body-s font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('inquiries')}
        </Link>
      ) : (
        <p className="mt-3 type-body-s text-fg-strong">{t('formsInPlan')}</p>
      )}
    </Panel>
  );
}

function AppearancePanel({ page }: { page: Page }) {
  const t = useTranslations('social.myPage');
  const update = useUpdatePage();
  const [saved, setSaved] = useState(false);
  return (
    <Panel title={t('appearanceTitle')}>
      <ThemePicker
        value={page.theme}
        onChange={(theme) =>
          update.mutate(
            { theme },
            {
              onSuccess: () => {
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2500);
              },
            },
          )
        }
      />
      <p role="status" className="mt-2 type-caption">
        {saved ? t('themeSaved') : t('themeNote')}
      </p>
      <p className="mt-3 type-body-s">
        <Link href="/minha-pagina/comecar?passo=3" className="underline underline-offset-4">
          {t('editProfile')}
        </Link>
        {' · '}
        <Link href="/minha-pagina/comecar?passo=5" className="underline underline-offset-4">
          {t('editProperties')}
        </Link>
      </p>
    </Panel>
  );
}

function ChecklistPanel({ page }: { page: Page }) {
  const t = useTranslations('social.myPage.checklist');
  const done = CHECKLIST.filter((k) => page.checklist[k]).length;
  return (
    <Panel title={t('title', { done, total: CHECKLIST.length })}>
      <ul className="flex flex-col gap-2">
        {CHECKLIST.map((k) => (
          <li key={k} className="flex items-start gap-2 type-body-s">
            {page.checklist[k] ? (
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            )}
            <span className={page.checklist[k] ? 'text-fg-muted' : 'text-fg'}>
              <span className="sr-only">{page.checklist[k] ? t('done') : t('todo')} </span>
              {t(k)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Endereço: a new {slug}; the old one keeps leading here (and stays yours). */
function ChangeAddress({ page }: { page: Page }) {
  const t = useTranslations('social.myPage.address');
  const change = useChangePageSlug();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<SlugCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const suffix = page.url.replace(/^https?:\/\/[^.]+/, '');

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setChecking(true);
    setFailed(null);
    try {
      setResult(await checkPageSlug(value.trim()));
    } catch {
      setFailed(t('checkError'));
    } finally {
      setChecking(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
          {t('change')}
        </Button>
        {page.old_slugs.length ? (
          <p className="type-caption">
            {t('oldOnes', { list: page.old_slugs.map((s) => `${s}${suffix}`).join(', ') })}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <form
      onSubmit={verify}
      noValidate
      className="flex flex-col gap-3 rounded-card border border-line p-4"
    >
      <Input
        label={t('label')}
        help={t('help', { suffix })}
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        value={value}
        onChange={(e) => {
          setValue(e.target.value.toLowerCase());
          setResult(null);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" loading={checking} loadingLabel={t('checking')}>
          {t('check')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setResult(null);
            setValue('');
          }}
        >
          {t('cancel')}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="type-body-s text-danger">
          {failed}
        </p>
      ) : null}
      {result?.problem ? (
        <p role="alert" className="type-body-s text-danger">
          {t(`problems.${result.problem}`)}
        </p>
      ) : null}
      {result && !result.problem ? (
        <div role="status" className="flex flex-col gap-3">
          <p className="type-body-s text-fg-strong">
            {t('free', { url: result.url.replace(/^https?:\/\//, '') })}
          </p>
          <Callout tone="info">{t('whatHappens')}</Callout>
          <Button
            className="w-fit"
            loading={change.isPending}
            loadingLabel={t('saving')}
            onClick={() =>
              change.mutate(result.slug, {
                onSuccess: () => {
                  setOpen(false);
                  setResult(null);
                  setValue('');
                },
              })
            }
          >
            {t('confirm')}
          </Button>
          {change.error ? (
            <p role="alert" className="type-body-s text-danger">
              {change.error instanceof CrmError && change.error.message
                ? change.error.message
                : t('saveError')}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
