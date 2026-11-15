'use client';

import { Avatar, Button, Panel, QualificationPanel, StatusPill } from '@casvitta/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { SimulationBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import type { ConversationDetail } from '@/lib/data/conversations';
import { useBroker, useConversation } from '@/lib/data/hooks';
import { simulateSac } from '@/lib/finance';
import { formatBRL, formatBRLShort, formatPercent, formatRateBps } from '@/lib/format';

import { ThreadHeader } from './ConversationsScreen';
import { Thread } from './thread';

/** Mockup 15 (desktop) and 22 (phone): one conversation with the qualification side panel. */
export function ConversationScreen({ conversationId }: { conversationId: string }) {
  const t = useTranslations('conversation');
  const query = useConversation(conversationId);
  return (
    <ScreenStates
      query={query}
      subject={t('subject')}
      empty={{ title: t('notFoundTitle'), description: t('notFoundDescription') }}
    >
      {(detail) => <ConversationLayout detail={detail} />}
    </ScreenStates>
  );
}

function ConversationLayout({ detail }: { detail: ConversationDetail }) {
  const t = useTranslations('conversation');
  const tNav = useTranslations('nav');
  const { conversation, lead } = detail;
  const name = conversation.person.name;
  const firstName = name.split(' ')[0] ?? name;
  const title =
    conversation.aiMode === 'handed_off'
      ? t('humanTitle', { name: firstName })
      : ['new', 'qualifying'].includes(lead.stage) || lead.qualification.financingPct === null
        ? t('qualifyingTitle', { name: firstName })
        : t('answeringTitle', { name: firstName });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[tNav('conversations'), name]}
        title={title}
        mobileTitle={name}
        mobileBack="/conversas"
        subtitle={t('subtitle')}
        demo
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Thread
          detail={detail}
          className="-mx-4 h-[calc(100dvh-56px-64px)] rounded-none border-x-0 md:mx-0 md:h-[860px] md:rounded-card md:border-x"
          headerClassName="hidden md:block"
          header={
            <div className="flex items-center gap-3">
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <ThreadHeader conversation={conversation} />
              </div>
            </div>
          }
        />
        <div className="hidden flex-col gap-5 md:flex">
          <QualificationSummary detail={detail} />
          <SimulationSummary detail={detail} />
          <RulesHere />
        </div>
      </div>
    </div>
  );
}

function QualificationSummary({ detail }: { detail: ConversationDetail }) {
  const t = useTranslations('conversation.qualification');
  const tStages = useTranslations('stages');
  const { lead } = detail;
  const q = lead.qualification;
  const firstName = lead.person.name.split(' ')[0] ?? '';
  const mono = (v: string) => <span className="font-mono">{v}</span>;
  const qualified = !['new', 'qualifying'].includes(lead.stage);
  return (
    <QualificationPanel
      title={t('title')}
      status={
        <StatusPill tone={qualified ? 'info' : 'attention'}>
          {qualified ? tStages('qualified') : t('pending')}
        </StatusPill>
      }
      rows={[
        {
          key: 'financing',
          label: t('financing'),
          value:
            q.financingPct === null
              ? '—'
              : q.financingPct
                ? t('yesPct', { pct: q.financingPct })
                : t('no'),
        },
        {
          key: 'fgts',
          label: t('fgts'),
          value: q.fgtsCents
            ? mono(t('yesAmount', { amount: formatBRLShort(q.fgtsCents) }))
            : q.usesFgts === false
              ? t('no')
              : '—',
        },
        {
          key: 'down',
          label: t('down'),
          value: q.downPaymentCents
            ? mono(
                t('downValue', {
                  amount: formatBRLShort(q.downPaymentCents),
                  pct: Math.round((q.downPaymentCents / lead.property.priceCents) * 100),
                }),
              )
            : '—',
        },
        {
          key: 'income',
          label: t('income'),
          value: q.householdIncomeCents ? mono(`~${formatBRLShort(q.householdIncomeCents)}`) : '—',
        },
        {
          key: 'timeframe',
          label: t('timeframe'),
          value: q.timeframe ? q.timeframe.charAt(0).toUpperCase() + q.timeframe.slice(1) : '—',
        },
      ]}
      footnote={t('footnote', { name: firstName })}
    />
  );
}

function SimulationSummary({ detail }: { detail: ConversationDetail }) {
  const t = useTranslations('conversation.simulation');
  const { lead } = detail;
  const q = lead.qualification;
  if (q.financingPct === null) return null;
  const price = lead.property.priceCents;
  const sim = simulateSac({
    priceCents: price,
    downPaymentCents: q.downPaymentCents ?? Math.round(price * 0.2),
    householdIncomeCents: q.householdIncomeCents,
  });
  const stat = (label: string, value: string) => (
    <div>
      <p className="type-caption">{label}</p>
      <p className="font-mono text-[18px] leading-6 font-semibold tabular">{value}</p>
    </div>
  );
  return (
    <Panel title={t('title')} aside={<SimulationBadge />}>
      <div className="grid grid-cols-2 gap-4">
        {stat(t('financed'), formatBRL(sim.principalCents))}
        {stat(t('first'), formatBRL(Math.round(sim.firstInstallmentCents / 100) * 100))}
        {stat(t('share'), sim.incomeShare ? formatPercent(sim.incomeShare) : '—')}
        {stat(t('rate'), t('rateValue', { rate: formatRateBps(sim.annualRateBps) }))}
      </div>
      <p className="mt-4 type-caption">
        {sim.incomeShare === null
          ? t('noIncome')
          : sim.incomeShare <= 0.3
            ? t('below')
            : t('above')}
      </p>
    </Panel>
  );
}

function RulesHere() {
  const t = useTranslations('conversation.rulesHere');
  const broker = useBroker().data;
  return (
    <Panel title={t('title')}>
      <ul className="flex list-disc flex-col gap-1 pl-5 type-body-s text-fg-strong">
        <li>{t('items.intro', { broker: broker?.firstName ?? '' })}</li>
        <li>{t('items.noPromise')}</li>
        <li>{t('items.slots')}</li>
        <li>{t('items.handoff')}</li>
      </ul>
      <Button asChild className="mt-4 w-full">
        <Link href="/agenda">{t('cta')}</Link>
      </Button>
    </Panel>
  );
}
