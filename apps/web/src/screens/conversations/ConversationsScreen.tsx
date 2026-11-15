'use client';

import {
  Avatar,
  Button,
  cn,
  KeyValueList,
  Panel,
  SegmentedControl,
  StatusPill,
} from '@casvitta/ui';
import { MessageSquare, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import { useRelativeTime } from '@/components/use-relative-time';
import type { AiRules } from '@/domain/types';
import { isAiAnswering, type InboxTab } from '@/lib/data/conversations';
import { actions, useAction, useConversation, useInbox } from '@/lib/data/hooks';
import type { ConversationView } from '@/lib/data/views';

import { Thread } from './thread';

export function ConversationsScreen() {
  const t = useTranslations('conversations');
  const query = useInbox();
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<InboxTab>('all');
  const inbox = query.data;
  const selectedId = params.get('c') ?? inbox?.conversations[0]?.id ?? null;
  const detail = useConversation(selectedId);
  const markRead = useAction(actions.markRead);
  const unread = detail.data?.conversation.unread;

  useEffect(() => {
    if (selectedId && unread) markRead.mutate([selectedId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, unread]);

  const filtered = (inbox?.conversations ?? []).filter((c) =>
    tab === 'all' ? true : tab === 'ai' ? isAiAnswering(c) : c.aiMode === 'handed_off',
  );
  const tabs = inbox
    ? [
        { value: 'needs_you', label: t('tabs.needsYou', { count: inbox.counts.needsYou }) },
        { value: 'ai', label: t('tabs.ai', { count: inbox.counts.ai }) },
        { value: 'all', label: t('tabs.all') },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[t('title')]}
        title={t('title')}
        subtitle={
          inbox
            ? t('subtitle', { ai: inbox.counts.ai, needsYou: inbox.counts.needsYou })
            : undefined
        }
        demo
      />
      <ScreenStates
        query={query}
        subject={t('subject')}
        isEmpty={(d) => d.conversations.length === 0}
        empty={{
          icon: <MessageSquare strokeWidth={1.6} />,
          title: t('emptyTitle'),
          description: t('emptyDescription'),
        }}
      >
        {(data) => (
          <>
            {/* Phone: list only, the thread opens on its own page (mockups 36 → 22). */}
            <div className="flex flex-col gap-4 md:hidden">
              <SegmentedControl
                label={t('tabsLabel')}
                className="grid grid-cols-3"
                value={tab}
                onValueChange={(v) => setTab(v as InboxTab)}
                options={[
                  {
                    value: 'needs_you',
                    label: t('tabs.needsYouShort', { count: data.counts.needsYou }),
                  },
                  { value: 'ai', label: t('tabs.ai', { count: data.counts.ai }) },
                  { value: 'all', label: t('tabs.all') },
                ]}
              />
              <ConversationList items={filtered} mobile />
            </div>

            <div className="hidden gap-5 md:grid md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
              <div className="flex flex-col overflow-hidden rounded-card border border-line bg-panel">
                <div className="p-3">
                  <SegmentedControl
                    label={t('tabsLabel')}
                    className="grid w-full grid-cols-3"
                    value={tab}
                    onValueChange={(v) => setTab(v as InboxTab)}
                    options={tabs}
                  />
                </div>
                <ConversationList
                  items={filtered}
                  selectedId={selectedId}
                  onSelect={(id) => router.replace(`?c=${id}`, { scroll: false })}
                />
              </div>
              {detail.data ? (
                <Thread
                  className="h-[640px]"
                  detail={detail.data}
                  header={<ThreadHeader conversation={detail.data.conversation} />}
                />
              ) : (
                <div className="rounded-card border border-line bg-panel" />
              )}
              {detail.data ? (
                <AiRulesPanel rules={detail.data.rules} className="hidden xl:block" />
              ) : null}
            </div>
          </>
        )}
      </ScreenStates>
    </div>
  );
}

function ConversationList({
  items,
  selectedId,
  onSelect,
  mobile = false,
}: {
  items: ConversationView[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  mobile?: boolean;
}) {
  const t = useTranslations('conversations');
  const relative = useRelativeTime();
  return (
    <ul
      className={cn(
        'flex flex-col divide-y divide-line',
        mobile ? '-mx-4 border-y border-line bg-panel' : 'border-t border-line',
      )}
    >
      {items.map((c) => {
        const needsYou = c.aiMode === 'handed_off';
        const ai = isAiAnswering(c);
        const last = c.lastMessage;
        const firstName = c.person.name.split(' ')[0];
        const prefix = !last
          ? ''
          : last.sender === 'ai'
            ? t('prefix.ai')
            : last.sender === 'human'
              ? t('prefix.you')
              : mobile
                ? ''
                : `${firstName}: `;
        const selected = c.id === selectedId;
        const body = (
          <>
            {mobile ? <Avatar name={c.person.name} size={48} /> : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="type-body font-semibold">{c.person.name}</span>
                {last ? (
                  <span className="shrink-0 font-mono type-caption">
                    {relative(last.sentAt, mobile ? 'short' : 'list')}
                  </span>
                ) : null}
              </div>
              <span className="truncate type-body-s text-fg-strong">{`${prefix}${last?.body ?? ''}`}</span>
              {needsYou ? (
                <span className="rounded-chip bg-attention px-1.5 text-[11px] leading-[18px] font-semibold text-fg">
                  {t('needsYouTag')}
                </span>
              ) : ai ? (
                <span className="rounded-chip bg-action-subtle px-1.5 text-[11px] leading-[18px] font-semibold text-action-hover">
                  {t('aiTag')}
                </span>
              ) : null}
            </div>
          </>
        );
        const classes = cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left',
          selected && 'bg-action-subtle shadow-[inset_3px_0_0_var(--color-action)]',
          mobile && needsYou && 'bg-attention-subtle',
          'hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        );
        return (
          <li key={c.id}>
            {mobile || !onSelect ? (
              <Link href={`/conversas/${c.id}`} className={classes}>
                {body}
              </Link>
            ) : (
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                className={classes}
                onClick={() => onSelect(c.id)}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ThreadHeader({ conversation }: { conversation: ConversationView }) {
  const t = useTranslations('conversations');
  const tChannels = useTranslations('channels');
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="type-body font-semibold">{conversation.person.name}</p>
        <p className="truncate type-caption">
          {[tChannels(conversation.channel), conversation.property.shortName, conversation.context]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {conversation.aiMode === 'handed_off' ? (
        <span className="shrink-0 rounded-chip bg-attention px-2 py-0.5 text-[12px] leading-5 font-semibold text-fg">
          {t('youAreInControl')}
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-action-subtle px-2 py-0.5 text-[12px] leading-5 font-semibold text-action-hover">
          <Sparkles aria-hidden="true" strokeWidth={1.6} className="size-3.5" />
          {t('aiAnswering')}
        </span>
      )}
    </div>
  );
}

export function AiRulesPanel({ rules, className }: { rules: AiRules; className?: string }) {
  const t = useTranslations('conversations.rules');
  return (
    <Panel
      title={t('title')}
      aside={
        <StatusPill tone={rules.enabled ? 'success' : 'neutral'}>
          {rules.enabled ? t('on') : t('off')}
        </StatusPill>
      }
      className={className}
    >
      <KeyValueList
        className="border-t border-line"
        rows={[
          ...rules.rules.map((r) => ({
            key: r.key,
            label: r.label,
            value: (
              <span className={r.value === 'never' ? 'text-danger' : 'text-success'}>
                {t(`values.${r.value === 'never' ? 'never' : 'yes'}`)}
              </span>
            ),
          })),
          { key: 'hours', label: t('hours'), value: rules.hours },
        ]}
      />
      <p className="mt-4 type-caption">{t('note')}</p>
      <Button asChild variant="secondary" className="mt-4 w-full">
        <Link href="/configuracoes">{t('edit')}</Link>
      </Button>
    </Panel>
  );
}
