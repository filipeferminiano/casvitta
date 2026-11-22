'use client';

import {
  Button,
  Callout,
  DataTable,
  Input,
  Panel,
  StatusPill,
  formatBRL,
  type DataTableColumn,
} from '@casvitta/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { DemoBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { SITE_URL } from '@/config/site';
import { CrmError } from '@/lib/data/crm';
import {
  addPhoto,
  publish,
  updateProperty,
  useMatchingContacts,
  useProperty,
  usePropertyMutation,
  type MatchingContact,
  type PropertyOut,
} from '@/lib/data/properties';
import { formatDate } from '@/lib/format';

import { listingState } from './PropertiesScreen';
import { ConsentMarks, CrmStates, useInterestLine } from './shared';

const MIN_PHOTOS = 5;

/** The public address of a marketplace listing: casvitta.com.br/imovel/{slug}-cv-{n}. */
export const listingUrl = (p: PropertyOut) =>
  `${SITE_URL}/imovel/${p.slug}-${p.code.toLowerCase()}`;

/** CR5 · Publicado (docs/mockups/crm/05-property-published), and what is missing before it. */
export function PropertyScreen({ id }: { id: string }) {
  const t = useTranslations('crm.properties');
  const property = useProperty(id);
  return (
    <CrmStates query={property} subject={t('subject')}>
      {(p) => <PropertyView p={p} />}
    </CrmStates>
  );
}

function PropertyView({ p }: { p: PropertyOut }) {
  const t = useTranslations('crm.properties');
  const tCosts = useTranslations('liveListing');
  const tErr = useTranslations('crm.errors');
  const state = listingState(p);
  const marketplace = p.listings.find((l) => l.channel === 'marketplace');
  const doPublish = usePropertyMutation(async () => {
    if (p.status !== 'active') await updateProperty(p.id, { status: 'active' });
    return publish(p.id, 'marketplace');
  });
  const upload = usePropertyMutation(async (files: File[]) => {
    for (const file of files) await addPhoto(p.id, file);
  });
  const [error, setError] = useState<string | null>(null);

  const title =
    state === 'published'
      ? t('detail.published', { code: p.code })
      : state === 'pending_review'
        ? t('detail.pending', { code: p.code })
        : t('detail.draft', { code: p.code });
  const subtitle =
    state === 'published'
      ? t('detail.publishedSubtitle')
      : state === 'pending_review'
        ? t('detail.pendingSubtitle')
        : t('detail.draftSubtitle');
  const blockers = p.blockers.filter((b) => !(b === 'property_not_active' && p.status === 'draft'));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader breadcrumb={[t('title'), p.code]} title={title} subtitle={subtitle} />
      {p.is_demo ? <DemoBadge className="self-start" /> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel
            title={`${p.title ?? `${t(`kinds.${p.kind}`)} · ${p.neighborhood}`}${p.area_m2 ? ` · ${p.area_m2} m²` : ''}`}
          >
            <p className="type-body-s text-fg-muted">
              {p.neighborhood}, {p.city} · {t(`transaction.${p.transaction}`)} · {p.code}
            </p>
            <p className="mt-2 type-value">{formatBRL(p.price_cents)}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 type-body-s">
              <dt className="text-fg-muted">{tCosts('costCondo')}</dt>
              <dd>
                {p.condo_fee_cents != null ? formatBRL(p.condo_fee_cents) : t('detail.notInformed')}
              </dd>
              <dt className="text-fg-muted">{tCosts('costIptu')}</dt>
              <dd>
                {p.iptu_monthly_cents != null
                  ? formatBRL(p.iptu_monthly_cents)
                  : t('detail.notInformed')}
              </dd>
            </dl>
          </Panel>
          <Panel title={t('detail.where')}>
            <ul className="flex flex-col gap-3">
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-body-s">
                  <span className="font-semibold">{t('form.whereSite')}</span>
                  <span className="block type-caption">
                    {listingUrl(p).replace(/^https?:\/\//, '')}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill
                    tone={
                      state === 'published'
                        ? 'success'
                        : state === 'pending_review'
                          ? 'attention'
                          : 'neutral'
                    }
                  >
                    {state === 'published' && marketplace?.published_at
                      ? t('detail.since', { date: formatDate(new Date(marketplace.published_at)) })
                      : t(`listing.${state}`)}
                  </StatusPill>
                  {state === 'published' ? (
                    <a
                      href={listingUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      className="type-body-s font-semibold text-action"
                    >
                      {t('detail.open')}
                    </a>
                  ) : null}
                </span>
              </li>
            </ul>
          </Panel>
          <MatchingPanel id={p.id} />
        </div>
        <aside className="flex flex-col gap-6">
          {blockers.length > 0 ||
          state === 'none' ||
          state === 'draft' ||
          state === 'unpublished' ? (
            <Panel title={t('detail.blockers')}>
              {blockers.length > 0 ? (
                <ul className="flex flex-col gap-2 type-body-s">
                  {blockers.map((b) => (
                    <li key={b}>
                      ○{' '}
                      {t(`detail.blocker.${b}`, {
                        min: MIN_PHOTOS,
                        reason: p.authorization?.review_reason ?? '',
                      })}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Input
                className="mt-3"
                label={t('detail.addPhotos')}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hint={t('form.photosCount', { count: p.media.length, min: MIN_PHOTOS })}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) upload.mutate([files]);
                }}
              />
              {error ? (
                <Callout tone="risk" className="mt-3">
                  {error}
                </Callout>
              ) : null}
              <Button
                className="mt-3 w-full"
                loading={doPublish.isPending}
                disabled={blockers.some(
                  (b) => b !== 'property_not_active' && b !== 'creci_unverified',
                )}
                onClick={() =>
                  doPublish.mutate([], {
                    onError: (err) =>
                      setError(
                        err instanceof CrmError && err.message ? err.message : tErr('generic'),
                      ),
                  })
                }
              >
                {t('detail.publish')}
              </Button>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function MatchingPanel({ id }: { id: string }) {
  const t = useTranslations('crm.properties.detail');
  const matching = useMatchingContacts(id);
  const line = useInterestLine();
  const columns: DataTableColumn<MatchingContact>[] = [
    {
      key: 'name',
      header: t('matching'),
      cell: (m) => (
        <Link href={`/contatos/${m.person_id}`} className="font-semibold">
          {m.name}
        </Link>
      ),
    },
    {
      key: 'why',
      header: t('why'),
      cell: (m) => (
        <span className="type-body-s">
          {line(m.interest)}
          {!m.within_budget ? ` · ${t('overBudget')}` : ''}
        </span>
      ),
    },
    { key: 'consent', header: '', cell: (m) => <ConsentMarks consent={m.consent} /> },
  ];
  return (
    <Panel title={t('matching')}>
      <CrmStates
        query={matching}
        subject={t('matching')}
        isEmpty={(d) => d.length === 0}
        empty={{ title: t('noMatching') }}
      >
        {(rows) => (
          <DataTable
            caption={t('matching')}
            columns={columns}
            rows={rows}
            rowKey={(m) => m.person_id}
          />
        )}
      </CrmStates>
      <p className="mt-3 type-caption">{t('notifyNote')}</p>
    </Panel>
  );
}
