'use client';

import {
  Badge,
  Button,
  Chip,
  cn,
  DataTable,
  FunnelBars,
  Panel,
  PhotoPlaceholder,
  PropertyRow,
  StatTile,
  StatusPill,
  useToast,
} from '@casvitta/ui';
import { Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { AiBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import { useRelativeTime } from '@/components/use-relative-time';
import type { SocialPost } from '@/domain/types';
import type { ReportView } from '@/lib/data/ads';
import {
  actions,
  useAction,
  useBroker,
  useCampaignPanel,
  useCampaigns,
  useReport,
  useSocialPosts,
} from '@/lib/data/hooks';
import type { LeadView } from '@/lib/data/views';
import {
  formatBRL,
  formatDayMonth,
  formatDayMonthCompact,
  formatDayMonthLong,
  formatDayMonthShort,
  formatDayOfMonth,
  formatNumber,
  formatTime,
  formatWeekdayShort,
} from '@/lib/format';

const centsPer = (total: number, count: number) => (count ? Math.round(total / count) : null);

// ---------------------------------------------------------------- index

export function AdsIndexScreen() {
  const t = useTranslations('ads');
  const query = useCampaigns();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('index.subtitle')}
        actions={
          <Button asChild>
            <Link href="/anuncios/novo">{t('index.create')}</Link>
          </Button>
        }
        demo
      />
      <ScreenStates
        query={query}
        subject={t('index.subject')}
        isEmpty={(list) => list.length === 0}
        empty={{
          icon: <Megaphone strokeWidth={1.6} />,
          title: t('index.emptyTitle'),
          description: t('index.emptyDescription'),
          actions: (
            <Button asChild>
              <Link href="/anuncios/novo">{t('index.create')}</Link>
            </Button>
          ),
        }}
      >
        {(campaigns) => (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <ul className="flex flex-col gap-3">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <CampaignRow campaignId={c.id} />
                </li>
              ))}
            </ul>
            <Panel title={t('index.socialTitle')} className="self-start">
              <p className="type-body-s text-fg-strong">{t('index.socialDescription')}</p>
              <Button asChild variant="secondary" className="mt-4 w-full">
                <Link href="/anuncios/redes-sociais">{t('index.socialCta')}</Link>
              </Button>
            </Panel>
          </div>
        )}
      </ScreenStates>
    </div>
  );
}

function CampaignRow({ campaignId }: { campaignId: string }) {
  const t = useTranslations('ads');
  const panel = useCampaignPanel(campaignId).data;
  if (!panel) return null;
  const { campaign, property } = panel;
  return (
    <div className="flex flex-col gap-2">
      <PropertyRow
        photoCaption={t('photo')}
        title={
          <Link href={`/anuncios/${campaign.id}`} className="hover:underline">
            {property.shortName}
          </Link>
        }
        details={t('index.rowDetails', {
          day: campaign.stats.day,
          total: campaign.durationDays,
          perDay: formatBRL(campaign.dailyBudgetCents),
        })}
        price={formatBRL(campaign.stats.spentCents)}
        status={
          <>
            <StatusPill tone={campaign.status === 'live' ? 'success' : 'attention'}>
              {t(`status.${campaign.status}`)}
            </StatusPill>
            <Chip>{t('index.leads', { count: campaign.stats.conversations })}</Chip>
            <Chip>{t('index.visits', { count: campaign.stats.visits })}</Chip>
          </>
        }
        footer={
          <div className="flex gap-4 type-body-s font-semibold">
            <Link
              href={`/anuncios/${campaign.id}`}
              className="text-action underline underline-offset-2"
            >
              {t('index.openPanel')}
            </Link>
            {panel.latestReportId ? (
              <Link
                href={`/anuncios/relatorios/${panel.latestReportId}`}
                className="text-action underline underline-offset-2"
              >
                {t('index.openReport')}
              </Link>
            ) : null}
          </div>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- live ad panel (14)

export function CampaignScreen({ campaignId }: { campaignId: string }) {
  const t = useTranslations('ads.panel');
  const tAds = useTranslations('ads');
  const tSources = useTranslations('sources');
  const query = useCampaignPanel(campaignId);
  const relative = useRelativeTime();

  return (
    <ScreenStates
      query={query}
      subject={t('subject')}
      empty={{ title: t('notFoundTitle'), description: t('notFoundDescription') }}
    >
      {(panel) => {
        const { campaign, property, newestLead } = panel;
        const s = campaign.stats;
        return (
          <div className="flex flex-col gap-6">
            <PageHeader
              breadcrumb={[tAds('title'), t('breadcrumb')]}
              title={t('title', { property: property.shortName, days: s.day })}
              mobileTitle={property.shortName}
              mobileBack="/anuncios"
              subtitle={t('subtitle')}
              demo
            />
            {newestLead ? (
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-fg px-5 py-4 text-white">
                <p className="flex items-center gap-3 type-body-s">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-pill bg-attention"
                  />
                  <span>
                    {t.rich('newLead', {
                      name: newestLead.person.name,
                      source: tSources(newestLead.source),
                      when: relative(newestLead.createdAt),
                      strong: (c) => <strong>{c}</strong>,
                    })}
                  </span>
                </p>
                {newestLead.conversationId ? (
                  <Button asChild variant="secondary" className="border-white">
                    <Link href={`/conversas/${newestLead.conversationId}`}>{t('follow')}</Link>
                  </Button>
                ) : null}
              </section>
            ) : null}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatTile
                label={t('spent')}
                value={formatBRL(s.spentCents)}
                caption={t('spentCaption', {
                  max: formatBRL(campaign.maxSpendCents),
                  day: s.day,
                  total: campaign.durationDays,
                })}
              />
              <StatTile
                label={t('contacts')}
                value={s.conversations}
                caption={
                  panel.costPerLeadCents
                    ? t('each', { amount: formatBRL(panel.costPerLeadCents) })
                    : undefined
                }
              />
              <StatTile
                label={t('visits')}
                value={s.visits}
                caption={
                  panel.costPerVisitCents
                    ? t('each', { amount: formatBRL(panel.costPerVisitCents) })
                    : undefined
                }
              />
              <StatTile
                label={t('status')}
                value={tAds(`status.${campaign.status}`)}
                caption={t('channels', { count: panel.paidChannels })}
              />
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel
                title={t('leadsTitle')}
                aside={
                  <Link
                    href="/leads"
                    className="type-body-s font-medium text-action underline underline-offset-2"
                  >
                    {t('seeAll')}
                  </Link>
                }
                flush
              >
                {panel.leads.length === 0 ? (
                  <p className="px-5 pb-5 type-body-s text-fg-muted">{t('noLeads')}</p>
                ) : (
                  <ul className="border-t border-line">
                    {panel.leads.map((lead, i) => (
                      <CampaignLeadRow key={lead.id} lead={lead} highlight={i === 0} />
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title={t('funnelTitle')}>
                <FunnelBars
                  label={t('funnelTitle')}
                  log
                  highlightLast
                  caption={t('logNote')}
                  items={[
                    {
                      key: 'reach',
                      label: t('funnel.reach'),
                      value: s.reach,
                      display: formatNumber(s.reach),
                    },
                    { key: 'clicks', label: t('funnel.clicks'), value: s.clicks },
                    {
                      key: 'conversations',
                      label: t('funnel.conversations'),
                      value: s.conversations,
                    },
                    { key: 'qualified', label: t('funnel.qualified'), value: s.qualified },
                    { key: 'visits', label: t('funnel.visits'), value: s.visits },
                  ]}
                />
              </Panel>
            </div>
          </div>
        );
      }}
    </ScreenStates>
  );
}

function CampaignLeadRow({ lead, highlight }: { lead: LeadView; highlight: boolean }) {
  const t = useTranslations('ads.panel');
  const tStages = useTranslations('stages');
  const tSources = useTranslations('sources');
  const relative = useRelativeTime();
  const q = lead.qualification;
  const chips = [
    q.usesFgts ? t('chips.fgts') : null,
    q.financingPct ? t('chips.financing', { pct: q.financingPct }) : null,
    q.downPaymentCents
      ? t('chips.down', { pct: Math.round((q.downPaymentCents / lead.property.priceCents) * 100) })
      : null,
    lead.nextAppointment
      ? `${formatWeekdayShort(lead.nextAppointment.startsAt).split(' ')[0]} ${formatDayMonth(lead.nextAppointment.startsAt)} · ${formatTime(new Date(lead.nextAppointment.startsAt))}`
      : null,
  ].filter(Boolean) as string[];
  const status =
    lead.stage === 'new' && lead.aiMode === 'active' ? (
      <StatusPill tone="info">{t('aiActive')}</StatusPill>
    ) : lead.needsHuman ? (
      <StatusPill tone="attention">{lead.note ?? t('needsYou')}</StatusPill>
    ) : (
      <StatusPill tone={lead.stage === 'visit_booked' ? 'success' : 'info'}>
        {tStages(lead.stage)}
      </StatusPill>
    );
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-b-0',
        highlight && 'bg-attention-subtle shadow-[inset_4px_0_0_var(--color-attention)]',
      )}
    >
      <Link href={`/leads/${lead.id}`} className="min-w-36 flex-1">
        <span className="block type-body font-semibold hover:underline">{lead.person.name}</span>
        <span className="block type-caption">{`${tSources(lead.source)} · ${relative(lead.createdAt, 'list')}`}</span>
      </Link>
      <span className="flex flex-1 flex-wrap gap-1.5">
        {chips.slice(0, 2).map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </span>
      {status}
    </li>
  );
}

// ---------------------------------------------------------------- weekly report (17, 23)

export function ReportScreen({ reportId }: { reportId: string }) {
  const t = useTranslations('ads.report');
  const query = useReport(reportId);
  return (
    <ScreenStates
      query={query}
      subject={t('subject')}
      empty={{ title: t('notFoundTitle'), description: t('notFoundDescription') }}
    >
      {(report) => (
        <>
          <DesktopReport report={report} />
          <MobileReport report={report} />
        </>
      )}
    </ScreenStates>
  );
}

function useReportNumbers(report: ReportView) {
  const { totals } = report;
  return {
    perLead: centsPer(totals.spentCents, totals.leads),
    perVisit: centsPer(totals.spentCents, totals.visits),
    perQualified: centsPer(totals.spentCents, totals.qualified),
  };
}

function SuggestionActions({ reportId, full = true }: { reportId: string; full?: boolean }) {
  const t = useTranslations('ads.report');
  const toast = useToast();
  const apply = useAction(actions.applySuggestion);
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        className={full ? undefined : 'w-full'}
        loading={apply.isPending}
        loadingLabel={t('applying')}
        onClick={() =>
          apply.mutate([reportId], { onSuccess: () => toast({ title: t('appliedToast') }) })
        }
      >
        {t('apply')}
      </Button>
      {full ? (
        <Button
          variant="secondary"
          onClick={() => toast({ title: t('keptToast'), tone: 'neutral' })}
        >
          {t('keep')}
        </Button>
      ) : null}
    </div>
  );
}

function DesktopReport({ report }: { report: ReportView }) {
  const t = useTranslations('ads.report');
  const tAds = useTranslations('ads');
  const n = useReportNumbers(report);
  const max = Math.max(...report.leadsPerDay.map((d) => d.leads), 1);
  const money = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  return (
    <div className="hidden flex-col gap-6 md:flex">
      <PageHeader
        breadcrumb={[tAds('title'), t('breadcrumb'), report.property.shortName]}
        title={t('title', {
          week: report.week,
          amount: formatBRL(Math.round((n.perVisit ?? 0) / 100) * 100),
        })}
        subtitle={t('subtitle', {
          from: formatDayOfMonth(report.periodStart),
          to: formatDayMonthLong(report.periodEnd),
        })}
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            {t('pdf')}
          </Button>
        }
        demo
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label={t('spent')}
          value={formatBRL(report.totals.spentCents)}
          caption={t('spentCaption', {
            perDay: formatBRL(report.dailyBudgetCents),
            days: report.days,
          })}
        />
        <StatTile
          highlighted
          label={t('perLead')}
          value={n.perLead ? formatBRL(n.perLead) : '—'}
          caption={t('contacts', { count: report.totals.leads })}
        />
        <StatTile
          highlighted
          label={t('perVisit')}
          value={n.perVisit ? formatBRL(n.perVisit) : '—'}
          caption={t('visitsCaption', { count: report.totals.visits, done: report.visitsDone })}
        />
        <StatTile
          label={t('perQualified')}
          value={n.perQualified ? formatBRL(n.perQualified) : '—'}
          caption={t('qualifiedCaption', { count: report.totals.qualified })}
        />
      </div>
      <DataTable
        caption={t('byChannel')}
        rows={report.rows}
        rowKey={(r) => r.channel}
        showTotals
        columns={[
          {
            key: 'channel',
            header: t('cols.channel'),
            cell: (r) => <strong>{tAds(`channels.${r.channel}.name`)}</strong>,
            total: <strong>{t('total')}</strong>,
          },
          {
            key: 'spent',
            header: t('cols.spent'),
            numeric: true,
            cell: (r) => money(r.spentCents),
            total: money(report.totals.spentCents),
          },
          {
            key: 'leads',
            header: t('cols.leads'),
            numeric: true,
            cell: (r) => r.leads,
            total: report.totals.leads,
          },
          {
            key: 'qualified',
            header: t('cols.qualified'),
            numeric: true,
            cell: (r) => r.qualified,
            total: report.totals.qualified,
          },
          {
            key: 'visits',
            header: t('cols.visits'),
            numeric: true,
            cell: (r) => r.visits,
            total: report.totals.visits,
          },
          {
            key: 'perVisit',
            header: t('cols.perVisit'),
            numeric: true,
            cell: (r) =>
              r.visits && r.spentCents ? money(Math.round(r.spentCents / r.visits)) : '—',
            total: n.perVisit ? money(n.perVisit) : '—',
          },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('perDay')}>
          <figure>
            <div
              className="flex h-40 items-end gap-3 border-b border-line"
              role="img"
              aria-label={t('perDayLabel', { total: report.totals.leads, days: report.days })}
            >
              {report.leadsPerDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="font-mono type-caption">{d.leads}</span>
                  <span
                    className="w-full max-w-9 rounded-t-chip bg-action"
                    style={{ height: `${(d.leads / max) * 100}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-3">
              {report.leadsPerDay.map((d) => (
                <span key={d.day} className="flex-1 text-center font-mono type-caption">
                  {formatDayMonthCompact(d.day)}
                </span>
              ))}
            </div>
            <figcaption className="mt-3 type-caption">
              {t('perDayCaption', {
                total: report.totals.leads,
                days: report.days,
                perDay: formatBRL(report.dailyBudgetCents),
              })}
            </figcaption>
          </figure>
        </Panel>
        <Panel title={t('suggestionTitle')} aside={<AiBadge />}>
          <p className="type-body text-fg-strong">{report.suggestion.body}</p>
          {report.suggestion.smallSample ? (
            <p className="my-4 rounded-control bg-attention-subtle px-3 py-2.5 type-body-s text-attention-fg">
              <strong>{t('smallSample')}</strong> {report.suggestion.smallSample}
            </p>
          ) : null}
          <SuggestionActions reportId={report.id} />
        </Panel>
      </div>
      <p className="type-body-s text-fg-muted">{t('footnote')}</p>
    </div>
  );
}

function MobileReport({ report }: { report: ReportView }) {
  const t = useTranslations('ads.report');
  const n = useReportNumbers(report);
  const tile = (label: string, value: string) => (
    <StatTile label={label} value={value} className="p-3" />
  );
  return (
    <div className="flex flex-col gap-4 md:hidden">
      <PageHeader title={t('mobileTitle', { week: report.week })} mobileBack="/anuncios" demo />
      <div>
        <p className="type-body-s text-fg-muted">
          {t('mobilePeriod', {
            property: report.property.shortName,
            from: formatDayOfMonth(report.periodStart),
            to: formatDayMonthShort(report.periodEnd),
          })}
        </p>
        <p className="type-title text-[24px]">
          {t('headline', { amount: formatBRL(Math.round((n.perVisit ?? 0) / 100) * 100) })}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tile(t('spent'), formatBRL(report.totals.spentCents))}
        {tile(t('perLeadShort'), n.perLead ? formatBRL(n.perLead) : '—')}
        {tile(t('perVisitShort'), n.perVisit ? formatBRL(n.perVisit) : '—')}
        {tile(t('visitsShort'), String(report.totals.visits))}
      </div>
      <Panel title={t('funnelTitle')}>
        <dl className="divide-y divide-line border-t border-line">
          {[
            [t('funnel.contacts'), report.totals.leads],
            [t('funnel.qualified'), report.totals.qualified],
            [t('funnel.visits'), report.totals.visits],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between py-2.5 type-body-s">
              <dt>{label}</dt>
              <dd className="font-mono font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title={t('suggestionShort')} aside={<Badge variant="ai">{t('ai')}</Badge>}>
        <p className="type-body-s text-fg-strong">{report.suggestion.body}</p>
        {report.suggestion.smallSample ? (
          <p className="mt-2 type-caption text-attention-fg">{`${t('smallSample')} ${report.suggestion.smallSample}`}</p>
        ) : null}
        <div className="mt-3">
          <SuggestionActions reportId={report.id} full={false} />
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- social (42)

export function SocialScreen() {
  const t = useTranslations('ads.social');
  const tAds = useTranslations('ads');
  const query = useSocialPosts();
  const broker = useBroker().data;
  if (broker && broker.plan !== 'profissional') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader breadcrumb={[tAds('title'), t('breadcrumb')]} title={t('title')} demo />
        <Panel>
          <p className="type-body">{t('planRequired')}</p>
          <Button asChild className="mt-4">
            <Link href="/configuracoes">{t('seePlans')}</Link>
          </Button>
        </Panel>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[tAds('title'), t('breadcrumb')]}
        title={t('title')}
        mobileBack="/anuncios"
        demo
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-card bg-subtle p-4">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="type-body font-semibold">{t('weekCalendar')}</h2>
            <Badge variant="ai">{t('suggestedByAi')}</Badge>
          </header>
          <ScreenStates
            query={query}
            subject={t('subject')}
            isEmpty={(p) => p.length === 0}
            empty={{ title: t('emptyTitle'), description: t('emptyDescription') }}
          >
            {(posts) => (
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ul>
            )}
          </ScreenStates>
        </section>
        <div className="flex flex-col">
          <ul className="divide-y divide-line border-y border-line">
            {(['connect', 'suggest', 'inbox', 'boost', 'report'] as const).map((key) => (
              <li key={key} className="py-2.5 type-body text-fg-strong">
                {t(`points.${key}`)}
              </li>
            ))}
          </ul>
          <p className="mt-4 type-caption">{t('requirement')}</p>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: SocialPost }) {
  const t = useTranslations('ads.social');
  const approve = useAction(actions.approvePost);
  const toast = useToast();
  const statusTone =
    post.status === 'published' ? 'success' : post.status === 'scheduled' ? 'info' : 'attention';
  return (
    <li className="flex flex-col">
      <p className="mb-2 type-body-s font-semibold text-fg-strong">
        {formatWeekdayShort(post.date)}
      </p>
      <article className="flex flex-1 flex-col overflow-hidden rounded-card border border-line bg-panel">
        <PhotoPlaceholder caption={t(`formats.${post.format}`)} className="aspect-square w-full" />
        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="type-body-s font-semibold">{post.title}</h3>
          <div className="flex flex-wrap gap-1">
            {post.channels.map((c) => (
              <Chip key={c}>{t(`channels.${c}`)}</Chip>
            ))}
          </div>
          <StatusPill tone={statusTone} className="self-start whitespace-normal">
            {post.status === 'scheduled' && post.scheduledAt
              ? t('scheduledAt', { time: formatTime(new Date(post.scheduledAt)) })
              : t(`status.${post.status}`)}
          </StatusPill>
          {post.status === 'awaiting_approval' || post.status === 'suggested' ? (
            <Button
              size="sm"
              className="mt-auto"
              loading={approve.isPending}
              loadingLabel={t('approving')}
              onClick={() =>
                approve.mutate([post.id], { onSuccess: () => toast({ title: t('approvedToast') }) })
              }
            >
              {t('approve')}
            </Button>
          ) : null}
        </div>
      </article>
    </li>
  );
}
