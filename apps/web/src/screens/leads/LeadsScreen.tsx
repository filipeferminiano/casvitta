'use client';

import {
  Button,
  cardLinkClass,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  KanbanBoard,
  LeadCard,
} from '@casvitta/ui';
import { ChevronDown, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import { useRelativeTime } from '@/components/use-relative-time';
import type { ActiveStage, LeadSource } from '@/domain/types';
import { actions, useAction, useKanban } from '@/lib/data/hooks';
import type { LeadView } from '@/lib/data/views';
import { formatBRLShort, formatTime } from '@/lib/format';
import { now } from '@/mocks/clock';

export function LeadsScreen() {
  const t = useTranslations('leads');
  const tStages = useTranslations('stages');
  const tSources = useTranslations('sources');
  const query = useKanban();
  const move = useAction(actions.moveLead);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<LeadSource | null>(null);

  const all = useMemo(() => query.data?.flatMap((c) => c.leads) ?? [], [query.data]);
  const properties = useMemo(
    () => [...new Map(all.map((l) => [l.property.id, l.property])).values()],
    [all],
  );
  const sources = useMemo(() => [...new Set(all.map((l) => l.source))], [all]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[t('title'), t('breadcrumb')]}
        title={t('title')}
        subtitle={t('subtitle', { leads: all.length, properties: properties.length })}
        demo
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterMenu
          label={t('filters.property', {
            value: properties.find((p) => p.id === propertyFilter)?.shortName ?? t('filters.allM'),
          })}
          options={[
            { value: null, label: t('filters.allM') },
            ...properties.map((p) => ({ value: p.id, label: p.shortName })),
          ]}
          onSelect={setPropertyFilter}
        />
        <FilterMenu
          label={t('filters.source', {
            value: sourceFilter ? tSources(sourceFilter) : t('filters.allF'),
          })}
          options={[
            { value: null, label: t('filters.allF') },
            ...sources.map((s) => ({ value: s, label: tSources(s) })),
          ]}
          onSelect={(v) => setSourceFilter(v as LeadSource | null)}
        />
        <FilterMenu
          label={t('filters.owner', { value: 'Ana' })}
          options={[{ value: null, label: 'Ana' }]}
          onSelect={() => {}}
        />
        <p className="ml-auto hidden type-body-s text-fg-muted lg:block">{t('legend')}</p>
        <Button asChild>
          <Link href="/leads/novo">{t('newLead')}</Link>
        </Button>
      </div>

      <ScreenStates
        query={query}
        subject={t('subject')}
        isEmpty={(cols) => cols.every((c) => c.leads.length === 0)}
        empty={{
          icon: <Users strokeWidth={1.6} />,
          title: t('emptyTitle'),
          description: t('emptyDescription'),
          actions: (
            <Button asChild variant="secondary">
              <Link href="/anuncios">{t('emptyAction')}</Link>
            </Button>
          ),
        }}
      >
        {(columns) => (
          <KanbanBoard<LeadView>
            label={t('boardLabel')}
            columns={columns.map((c) => {
              const items = c.leads.filter(
                (l) =>
                  (!propertyFilter || l.propertyId === propertyFilter) &&
                  (!sourceFilter || l.source === sourceFilter),
              );
              return {
                key: c.stage,
                title: tStages(c.stage),
                items,
                // Collapsed columns show the cards that carry news (mockup 31); the rest sit behind "+N".
                visibleCount: Math.max(1, items.filter(hasNews).length),
              };
            })}
            itemKey={(l) => l.id}
            itemLabel={(l) => l.person.name}
            onMove={(id, stage) => move.mutate([id, stage as ActiveStage])}
            renderItem={(lead, menu) => <KanbanLeadCard lead={lead} menu={menu} />}
            copy={{
              moveTo: t('moveTo'),
              moveMenuLabel: (name) => t('moveMenuLabel', { name }),
              showMore: (count) => t('showMore', { count }),
              showLess: t('showLess'),
              moved: (name, column) => t('moved', { name, column }),
              empty: t('emptyColumn'),
            }}
          />
        )}
      </ScreenStates>
      <p className="type-body-s text-fg-muted">{t('footnote')}</p>
    </div>
  );
}

function hasNews(lead: LeadView): boolean {
  const today = now().toDateString();
  return Boolean(
    lead.note ||
    lead.proposal ||
    (lead.stage === 'new' && lead.aiMode === 'active') ||
    (lead.nextAppointment && new Date(lead.nextAppointment.startsAt).toDateString() === today),
  );
}

function FilterMenu<V extends string | null>({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: { value: V; label: string }[];
  onSelect: (value: V) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="border-line font-normal">
          {label}
          <ChevronDown aria-hidden="true" strokeWidth={1.6} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem key={option.value ?? 'all'} onSelect={() => onSelect(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Card content follows mockup 31: one or two chips for the stage, then a status line. */
function KanbanLeadCard({ lead, menu }: { lead: LeadView; menu: React.ReactNode }) {
  const t = useTranslations('leads.card');
  const tSources = useTranslations('sources');
  const relative = useRelativeTime();
  const q = lead.qualification;
  const today = new Date(now()).toDateString();

  let chips: React.ReactNode = null;
  let note: React.ReactNode = lead.note;

  if (lead.stage === 'proposal' && lead.proposal) {
    chips = (
      <>
        <Chip>{formatBRLShort(lead.proposal.amountCents)}</Chip>
        <Chip tone="info">{t(`payment.${lead.proposal.payment}`)}</Chip>
      </>
    );
    note = t(`proposalStatus.${lead.proposal.status}`);
  } else if (lead.stage === 'visit_booked' && lead.nextAppointment) {
    const at = new Date(lead.nextAppointment.startsAt);
    chips = (
      <Chip tone="attention">
        {at.toDateString() === today
          ? t('today', { time: formatTime(at) })
          : t('onDay', {
              day: at.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                timeZone: 'America/Sao_Paulo',
              }),
              time: formatTime(at),
            })}
      </Chip>
    );
    note = lead.nextAppointment.status === 'confirmed' ? t('confirmed') : t('awaiting');
  } else if (lead.needsHuman) {
    chips = lead.note ? <Chip tone="attention">{lead.note}</Chip> : null;
    note = t('handedOff');
  } else if (lead.stage === 'new' && lead.aiMode === 'active') {
    chips = <Chip tone="info">{t('aiActive')}</Chip>;
    note = relative(lead.createdAt);
  } else if (q.financingPct !== null || q.usesFgts) {
    chips = (
      <>
        {q.usesFgts ? <Chip>{t('fgts')}</Chip> : null}
        {q.financingPct ? <Chip tone="info">{t('financing', { pct: q.financingPct })}</Chip> : null}
        {q.financingPct === 0 ? <Chip tone="info">{t('cash')}</Chip> : null}
      </>
    );
  } else if (lead.note) {
    chips = <Chip>{lead.note}</Chip>;
    note = lead.followUp;
  }
  if (!note) note = relative(lead.lastActivityAt);

  return (
    <LeadCard
      needsHuman={lead.needsHuman}
      name={
        <Link href={`/leads/${lead.id}`} className={cardLinkClass}>
          {lead.person.name}
        </Link>
      }
      cost={lead.acquisitionCostCents ? formatBRLShort(lead.acquisitionCostCents) : undefined}
      origin={`${tSources(lead.source)} · ${lead.property.shortName}`}
      chips={chips}
      note={note}
      menu={menu}
    />
  );
}
