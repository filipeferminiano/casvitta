'use client';

import { Button, Callout, Panel, StatTile, Switch } from '@casvitta/ui';
import { Check, Circle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { CrmError } from '@/lib/data/crm';
import { usePage, usePageStats, usePublishPage, useUpdatePage, type Page } from '@/lib/data/page';
import { formatNumber } from '@/lib/format';

import { CollectionsPanel } from './CollectionsEditor';
import { CopyLink } from './CopyLink';
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
        <p className="type-caption">{t('addressNote')}</p>
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
