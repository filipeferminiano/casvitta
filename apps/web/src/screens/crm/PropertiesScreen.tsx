'use client';

import { Button, DataTable, StatusPill, formatBRL, type DataTableColumn } from '@casvitta/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { DemoBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { useProperties, type PropertyOut } from '@/lib/data/properties';

import { CrmStates } from './shared';

export const listingState = (p: PropertyOut) =>
  p.listings.find((l) => l.channel === 'marketplace')?.status ?? 'none';

/** Imóveis (live): the broker's properties and whether each one is on the Casvitta site. */
export function PropertiesScreen() {
  const t = useTranslations('crm.properties');
  const list = useProperties();
  const columns: DataTableColumn<PropertyOut>[] = [
    {
      key: 'property',
      header: t('columns.property'),
      cell: (p) => (
        <div className="flex flex-col">
          <Link
            href={`/imoveis/${p.id}`}
            className="font-semibold underline-offset-4 hover:underline"
          >
            {p.title ?? `${t(`kinds.${p.kind}`)} · ${p.neighborhood}`}
          </Link>
          <span className="type-caption">
            {p.code} · {t(`transaction.${p.transaction}`)} · {p.neighborhood}, {p.city}
          </span>
          {p.is_demo ? <DemoBadge className="mt-0.5 self-start" /> : null}
        </div>
      ),
    },
    { key: 'price', header: t('columns.price'), cell: (p) => formatBRL(p.price_cents) },
    { key: 'status', header: t('columns.status'), cell: (p) => t(`status.${p.status}`) },
    {
      key: 'site',
      header: t('columns.site'),
      cell: (p) => {
        const state = listingState(p);
        return (
          <StatusPill
            tone={
              state === 'published'
                ? 'success'
                : state === 'pending_review'
                  ? 'attention'
                  : 'neutral'
            }
          >
            {t(`listing.${state}`)}
          </StatusPill>
        );
      },
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button asChild icon={<Plus aria-hidden="true" />}>
            <Link href="/imoveis/novo">{t('new')}</Link>
          </Button>
        }
      />
      <CrmStates
        query={list}
        subject={t('subject')}
        isEmpty={(d) => d.length === 0}
        empty={{
          title: t('empty'),
          actions: (
            <Button asChild>
              <Link href="/imoveis/novo">{t('new')}</Link>
            </Button>
          ),
        }}
      >
        {(rows) => (
          <DataTable caption={t('title')} columns={columns} rows={rows} rowKey={(p) => p.id} />
        )}
      </CrmStates>
    </div>
  );
}
