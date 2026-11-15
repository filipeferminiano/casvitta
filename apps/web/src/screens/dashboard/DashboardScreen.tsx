'use client';

import {
  Button,
  cn,
  FunnelBars,
  Panel,
  PanelList,
  StatTile,
  StatusPill,
  useToast,
} from '@casvitta/ui';
import { House } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { SoonBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import { useRelativeTime } from '@/components/use-relative-time';
import type { NeedsYouItem } from '@/lib/data/dashboard';
import { actions, useAction, useDashboard, useModules } from '@/lib/data/hooks';
import { formatBRL, formatBRLShort, formatLongDay, formatTime } from '@/lib/format';
import { now } from '@/mocks/clock';

export function DashboardScreen() {
  const t = useTranslations('dashboard');
  const tStages = useTranslations('stages');
  const query = useDashboard();
  const hour = Number(
    new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'America/Sao_Paulo',
    }).format(now()),
  );
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  return (
    <ScreenStates
      query={query}
      subject={t('subject')}
      empty={{
        icon: <House strokeWidth={1.6} />,
        title: t('emptyTitle'),
        description: t('emptyDescription'),
      }}
    >
      {(d) => (
        <div className="flex flex-col gap-6">
          <PageHeader
            eyebrow={formatLongDay(d.today)}
            title={t(`greeting.${greeting}`, { name: d.firstName })}
            subtitle={t('subtitle', { count: d.needsYou.length })}
            demo
          />

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile
              label={t('stats.activeLeads')}
              value={d.stats.activeLeads}
              caption={t('stats.newThisWeek', { count: d.stats.newThisWeek })}
            />
            <StatTile
              label={t('stats.visits')}
              value={d.stats.visitsThisWeek}
              caption={t('stats.confirmed', { count: d.stats.confirmedThisWeek })}
            />
            <StatTile
              label={t('stats.openProposals')}
              value={d.stats.openProposals}
              caption={d.stats.openProposalsProperty ?? undefined}
            />
            <StatTile
              label={t('stats.commission')}
              value={formatBRL(d.stats.commissionCents)}
              caption={t('stats.commissionCaption')}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-6">
              <Panel
                title={t('needsYou.title')}
                aside={
                  <span className="font-mono type-caption">
                    {t('needsYou.count', { count: d.needsYou.length })}
                  </span>
                }
                flush
              >
                <PanelList className="mx-5 mb-2">
                  {d.needsYou.map((item, i) => (
                    <NeedsYouRow key={i} item={item} />
                  ))}
                </PanelList>
              </Panel>

              <Panel
                title={t('today.title')}
                aside={
                  <Link
                    href="/agenda"
                    className="type-body-s font-medium text-action underline underline-offset-2"
                  >
                    {t('today.openCalendar')}
                  </Link>
                }
                flush
              >
                <PanelList className="mx-5 mb-2">
                  {d.todayAgenda.map((a) => (
                    <li key={a.id} className="flex items-center gap-6 py-4">
                      <span className="w-12 shrink-0 font-mono type-body font-semibold tabular">
                        {formatTime(new Date(a.startsAt))}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="type-body font-semibold">
                          {a.kind === 'visit'
                            ? t('today.visit', { name: a.lead?.person.name ?? '' })
                            : a.title}
                        </p>
                        <p className="type-body-s text-fg-muted">
                          {a.kind === 'visit'
                            ? [
                                a.propertyShortName,
                                a.status === 'confirmed' && a.lead?.qualification.financingPct
                                  ? t('today.finances', { pct: a.lead.qualification.financingPct })
                                  : a.lead
                                    ? t('today.cameFrom', { source: a.lead.source })
                                    : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : [a.propertyShortName, a.note?.toLocaleLowerCase('pt-BR')]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                      </div>
                      <StatusPill
                        tone={
                          a.kind === 'task'
                            ? 'neutral'
                            : a.status === 'confirmed'
                              ? 'success'
                              : 'attention'
                        }
                      >
                        {a.kind === 'task'
                          ? t('today.task')
                          : a.status === 'confirmed'
                            ? t('today.confirmed')
                            : t('today.awaiting')}
                      </StatusPill>
                    </li>
                  ))}
                </PanelList>
              </Panel>
            </div>

            <div className="flex flex-col gap-6">
              <Panel
                title={t('funnel.title')}
                aside={
                  <Link
                    href="/leads"
                    className="type-body-s font-medium text-action underline underline-offset-2"
                  >
                    {t('funnel.seeCrm')}
                  </Link>
                }
              >
                <FunnelBars
                  label={t('funnel.title')}
                  items={d.funnel.map((f) => ({
                    key: f.stage,
                    label: tStages(f.stage),
                    value: f.count,
                  }))}
                />
              </Panel>

              {d.campaign ? (
                <Panel
                  title={t('ads.title', { week: d.campaign.week.number })}
                  aside={<StatusPill tone="success">{t('ads.live')}</StatusPill>}
                >
                  <Link
                    href={`/anuncios/${d.campaign.id}`}
                    className="grid grid-cols-3 gap-3 rounded-control hover:bg-canvas"
                  >
                    <MiniStat
                      label={t('ads.spent')}
                      value={formatBRL(d.campaign.week.spentCents)}
                    />
                    <MiniStat label={t('ads.leads')} value={d.campaign.week.leads} />
                    <MiniStat
                      label={t('ads.perVisit')}
                      value={
                        d.campaign.costPerVisitCents ? formatBRL(d.campaign.costPerVisitCents) : '—'
                      }
                    />
                  </Link>
                  {d.campaign.week.note ? (
                    <p className="mt-3 type-body-s text-fg-muted">{d.campaign.week.note}</p>
                  ) : null}
                </Panel>
              ) : null}

              <RentalTeaser />
            </div>
          </div>
        </div>
      )}
    </ScreenStates>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="type-caption">{label}</span>
      <span className="font-mono text-[18px] leading-6 font-semibold tabular">{value}</span>
    </div>
  );
}

function NeedsYouRow({ item }: { item: NeedsYouItem }) {
  const t = useTranslations('dashboard.needsYou');
  const relative = useRelativeTime();
  const row = (
    dot: 'attention' | 'muted',
    title: string,
    detail: string,
    href: string,
    cta: string,
  ) => (
    <li className="flex items-start gap-3 py-4">
      <span
        aria-hidden="true"
        className={cn(
          'mt-2 size-2 shrink-0 rounded-pill',
          dot === 'attention' ? 'bg-attention' : 'bg-ink-300',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="type-body font-semibold">{title}</p>
        <p className="type-body-s text-fg-muted">{detail}</p>
      </div>
      <Link href={href} className="shrink-0 type-body-s font-semibold text-action hover:underline">
        {cta}
        <span aria-hidden="true">{' ›'}</span>
      </Link>
    </li>
  );
  switch (item.kind) {
    case 'compare_proposals':
      return row(
        'attention',
        t('compareTitle', { count: item.proposals.length, property: item.propertyShortName }),
        item.proposals
          .map((p) =>
            t('proposalLine', {
              name: p.name,
              amount: formatBRLShort(p.amountCents),
              payment: t(`payment.${p.payment}`),
            }),
          )
          .join(' · '),
        '/propostas',
        t('compare'),
      );
    case 'handoff':
      return row(
        'attention',
        t('handoffTitle', { name: item.leadName, reason: item.reason.toLocaleLowerCase('pt-BR') }),
        t('handoffDetail', { since: relative(item.since) }),
        `/conversas?c=${item.conversationId}`,
        t('reply'),
      );
    case 'stale_leads':
      return row(
        'muted',
        t('staleTitle', { count: item.count }),
        t('staleDetail'),
        '/leads',
        t('review'),
      );
  }
}

/** "Em breve" teaser: records interest only (CLAUDE.md §4.9). */
function RentalTeaser() {
  const t = useTranslations('dashboard.rental');
  const toast = useToast();
  const modules = useModules().data;
  const interest = useAction(actions.registerInterest);
  const rental = modules?.find((m) => m.key === 'rental');
  if (!rental) return null;
  return (
    <Panel title={t('title', { count: 1 })} aside={<SoonBadge />}>
      <p className="type-body-s text-fg-strong">{t('description')}</p>
      <Button
        variant="secondary"
        className="mt-4 border-dashed border-line-dashed"
        disabled={rental.interested || interest.isPending}
        onClick={() =>
          interest.mutate([rental.key], {
            onSuccess: () => toast({ title: t('toastTitle'), description: t('toastDescription') }),
          })
        }
      >
        {rental.interested ? t('interested') : t('notifyMe')}
      </Button>
    </Panel>
  );
}
