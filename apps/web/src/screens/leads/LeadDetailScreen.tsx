'use client';

import {
  Avatar,
  Button,
  Chip,
  FinancingSimulation,
  KeyValueList,
  Panel,
  StageProgress,
  Timeline,
} from '@casvitta/ui';
import {
  CalendarCheck,
  CalendarDays,
  FileText,
  Megaphone,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { AiBadge, SimulationBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import { useRelativeTime } from '@/components/use-relative-time';
import type { TimelineEventType } from '@/domain/types';
import { actions, useAction, useLeadDetail } from '@/lib/data/hooks';
import type { LeadDetail } from '@/lib/data/leads';
import { simulateSac } from '@/lib/finance';
import {
  formatBRL,
  formatBRLShort,
  formatDayMonth,
  formatPercent,
  formatRateBps,
  formatTime,
} from '@/lib/format';

const PROGRESS = ['new', 'qualified', 'visit_booked', 'visit_done', 'proposal', 'won'] as const;
const progressKey = (stage: string) => (stage === 'qualifying' ? 'new' : stage);

const ICONS: Record<TimelineEventType, React.ReactNode> = {
  arrived: <Megaphone />,
  qualified: <Sparkles />,
  visit_booked: <CalendarDays />,
  visit_done: <CalendarCheck />,
  message: <Sparkles />,
  proposal: <FileText />,
  stage_changed: <UserRound />,
};

/** Masks the middle of a phone for the CRM view: "(11) 9····-··21". */
function maskPhone(e164: string): string {
  const m = /^\+55(\d{2})(\d)\d+(\d{2})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}····-··${m[3]}` : e164;
}

export function LeadDetailScreen({ leadId }: { leadId: string }) {
  const t = useTranslations('leadDetail');
  const query = useLeadDetail(leadId);
  const markSeen = useAction(actions.markLeadSeen);
  const unseen = query.data?.lead.unseen;
  useEffect(() => {
    if (unseen) markSeen.mutate([leadId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseen, leadId]);

  return (
    <ScreenStates
      query={query}
      subject={t('subject')}
      empty={{ title: t('notFoundTitle'), description: t('notFoundDescription') }}
    >
      {(detail) => (
        <>
          <DesktopLeadDetail detail={detail} />
          <MobileLeadDetail detail={detail} />
        </>
      )}
    </ScreenStates>
  );
}

function useSimulation(detail: LeadDetail) {
  const { lead } = detail;
  const base = lead.proposal?.amountCents ?? lead.property.priceCents;
  const down = lead.qualification.downPaymentCents ?? Math.round(base * 0.2);
  return {
    base,
    sim: simulateSac({
      priceCents: base,
      downPaymentCents: down,
      householdIncomeCents: lead.qualification.householdIncomeCents,
    }),
  };
}

function DesktopLeadDetail({ detail }: { detail: LeadDetail }) {
  const t = useTranslations('leadDetail');
  const tStages = useTranslations('stages');
  const tSources = useTranslations('sources');
  const { lead, timeline } = detail;
  const q = lead.qualification;
  const { base, sim } = useSimulation(detail);
  const days = Math.max(
    1,
    Math.round(
      (new Date(timeline[0]?.occurredAt ?? lead.lastActivityAt).getTime() -
        new Date(lead.createdAt).getTime()) /
        86_400_000,
    ),
  );
  const consent = lead.person.consents.find((c) => c.purpose === 'contact_about_properties');
  const approx = (cents: number | null) => (cents ? `~${formatBRLShort(cents)}` : '—');

  return (
    <div className="hidden flex-col gap-6 md:flex">
      <PageHeader
        breadcrumb={[t('breadcrumb'), tStages(lead.stage), lead.person.name]}
        title={`${lead.person.name} · ${lead.property.shortName}`}
        subtitle={t('subtitle', { source: tSources(lead.source), stage: lead.stage, days })}
        actions={
          lead.conversationId ? (
            <Button asChild variant="secondary">
              <Link href={`/conversas?c=${lead.conversationId}`}>{t('openConversation')}</Link>
            </Button>
          ) : undefined
        }
        demo
      />
      <StageProgress
        label={t('stageLabel')}
        current={progressKey(lead.stage)}
        stages={PROGRESS.map((key) => ({ key, label: tStages(key) }))}
      />
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-5">
          <Panel>
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <Avatar name={lead.person.name} size={52} />
              <div>
                <h2 className="type-title text-[20px]">{lead.person.name}</h2>
                {lead.person.profileLabel ? (
                  <p className="type-body-s text-fg-muted">{lead.person.profileLabel}</p>
                ) : null}
              </div>
            </div>
            <KeyValueList
              rows={[
                {
                  key: 'phone',
                  label: t('phone'),
                  value: <span className="font-mono">{maskPhone(lead.person.phoneE164)}</span>,
                },
                { key: 'source', label: t('source'), value: tSources(lead.source) },
                {
                  key: 'financing',
                  label: t('financing'),
                  value: q.financingPct !== null ? `~${q.financingPct}%` : '—',
                },
                { key: 'fgts', label: t('fgts'), value: approx(q.fgtsCents) },
                { key: 'income', label: t('income'), value: approx(q.householdIncomeCents) },
                { key: 'timeframe', label: t('timeframe'), value: q.timeframe ?? '—' },
                {
                  key: 'consent',
                  label: t('consent'),
                  value: consent
                    ? t('consentValue', { date: formatDayMonth(consent.grantedAt) })
                    : t('noConsent'),
                },
              ]}
            />
            <p className="mt-3 type-caption">{t('unverified')}</p>
          </Panel>
          <FinancingSimulation
            title={t('simulation')}
            badge={<SimulationBadge />}
            context={
              lead.proposal
                ? t('aboutProposal', { amount: formatBRLShort(base) })
                : t('aboutPrice', { amount: formatBRLShort(base) })
            }
            result={t('perMonth', {
              amount: formatBRL(Math.round(sim.firstInstallmentCents / 100) * 100),
            })}
            details={t('simulationDetails', {
              term: sim.termMonths,
              rate: formatRateBps(sim.annualRateBps),
              share: sim.incomeShare ? formatPercent(sim.incomeShare) : '—',
            })}
          />
        </div>

        <Panel title={t('history')}>
          <Timeline
            items={timeline.map((e) => ({
              key: e.id,
              icon: ICONS[e.type],
              tone:
                e.type === 'visit_done' ? 'success' : e.type === 'arrived' ? 'attention' : 'action',
              time: `${formatDayMonth(e.occurredAt)} · ${formatTime(new Date(e.occurredAt))}`,
              title:
                e.type === 'stage_changed'
                  ? t('movedTo', { stage: tStages(e.title) })
                  : e.title || t(`eventTitles.${e.type}`),
              detail: e.detail || undefined,
            }))}
          />
        </Panel>

        <div className="flex flex-col gap-5">
          {detail.nextStep ? (
            <Panel title={t('nextStep')} aside={<AiBadge />}>
              <p className="type-body-s text-fg-strong">{detail.nextStep}</p>
              <div className="mt-4 flex flex-col gap-3">
                {lead.proposal ? (
                  <Button asChild>
                    <Link href="/propostas">{t('compareProposals')}</Link>
                  </Button>
                ) : null}
                {lead.conversationId ? (
                  <Button asChild variant="secondary">
                    <Link href={`/conversas?c=${lead.conversationId}`}>
                      {t('openConversation')}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </Panel>
          ) : null}
          {detail.alsoMatches.length ? (
            <Panel title={t('alsoMatches')}>
              <ul className="divide-y divide-line border-t border-line">
                {detail.alsoMatches.map((m) => (
                  <li key={m.propertyId} className="flex gap-3 py-3">
                    <span className="flex h-12 w-14 shrink-0 items-center rounded-chip border border-line bg-subtle px-1 type-caption leading-4">
                      {t('photo')}
                    </span>
                    <div>
                      <p className="type-body-s font-semibold">{m.label}</p>
                      <p className="type-caption">
                        {t(`matchOrigin.${m.origin}`, { price: formatBRLShort(m.priceCents) })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 type-caption">{t('alsoMatchesNote')}</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Phone layout (mockup 21). */
function MobileLeadDetail({ detail }: { detail: LeadDetail }) {
  const t = useTranslations('leadDetail');
  const tStages = useTranslations('stages');
  const tSources = useTranslations('sources');
  const relative = useRelativeTime();
  const { lead } = detail;
  const q = lead.qualification;
  const { sim } = useSimulation(detail);
  const firstName = lead.person.name.split(' ')[0];

  return (
    <div className="flex flex-col gap-4 md:hidden">
      <PageHeader
        title={lead.stage === 'new' ? t('newLead') : tStages(lead.stage)}
        mobileBack="/leads"
        demo
      />
      <p className="rounded-card bg-fg px-4 py-3 type-body-s text-white">
        <strong>{lead.person.name}</strong>{' '}
        {t('arrivedBanner', { when: relative(lead.createdAt), source: tSources(lead.source) })}{' '}
        {lead.aiMode === 'active' ? t('aiTalking') : null}
      </p>
      <Panel>
        <div className="flex items-center gap-3">
          <Avatar name={lead.person.name} size={48} />
          <div>
            <h2 className="type-title text-[20px]">{lead.person.name}</h2>
            <p className="type-body-s text-fg-muted">{`${lead.property.shortName} · ${tSources(lead.source)}`}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {q.financingPct ? (
            <Chip tone="info">{t('chips.financing', { pct: q.financingPct })}</Chip>
          ) : null}
          {q.fgtsCents ? (
            <Chip>{t('chips.fgts', { amount: formatBRLShort(q.fgtsCents) })}</Chip>
          ) : null}
          {q.downPaymentCents ? (
            <Chip>
              {t('chips.down', {
                pct: Math.round((q.downPaymentCents / lead.property.priceCents) * 100),
              })}
            </Chip>
          ) : null}
          {q.householdIncomeCents ? (
            <Chip>{t('chips.income', { amount: formatBRLShort(q.householdIncomeCents) })}</Chip>
          ) : null}
        </div>
        <div className="mt-3 flex items-end justify-between rounded-control bg-canvas px-3 py-2.5">
          <div>
            <p className="type-caption">{t('firstInstallment')}</p>
            <p className="font-mono text-[20px] leading-7 font-semibold tabular">
              {formatBRL(Math.round(sim.firstInstallmentCents / 100) * 100)}
            </p>
          </div>
          <SimulationBadge />
        </div>
        {lead.acquisitionCostCents ? (
          <p className="mt-3 type-body-s text-fg-strong">
            {t.rich('leadCost', {
              amount: formatBRL(lead.acquisitionCostCents),
              strong: (c) => <strong className="font-mono">{c}</strong>,
            })}
          </p>
        ) : null}
      </Panel>
      {lead.conversationId ? (
        <Button asChild>
          <Link href={`/conversas/${lead.conversationId}`}>{t('seeConversation')}</Link>
        </Button>
      ) : null}
      <Button asChild variant="secondary">
        <a href={`tel:${lead.person.phoneE164}`}>{t('call', { name: firstName ?? '' })}</a>
      </Button>
    </div>
  );
}
