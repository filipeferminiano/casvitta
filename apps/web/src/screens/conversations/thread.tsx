'use client';

import { AiDraftComposer, Badge, Button, ChatThread, type ChatItem } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { ConversationDetail } from '@/lib/data/conversations';
import { actions, useAction } from '@/lib/data/hooks';
import { formatBRLShort, formatDayMonth, formatTime, formatWeekdayShort } from '@/lib/format';

/** Messages -> chat items. System events are stored as codes and rendered from the catalog. */
export function useChatItems(detail: ConversationDetail, compact = false): ChatItem[] {
  const t = useTranslations('conversation');
  const tSources = useTranslations('sources');
  const firstName = detail.conversation.person.name.split(' ')[0] ?? '';
  const q = detail.lead.qualification;

  return detail.messages.map((m) => {
    const time = formatTime(new Date(m.sentAt));
    if (m.sender !== 'system') {
      const who = m.sender === 'lead' ? firstName : m.sender === 'ai' ? t('ai') : t('you');
      return {
        kind: 'message',
        id: m.id,
        side: m.sender === 'lead' ? 'in' : 'out',
        text: m.body,
        meta: `${who} · ${time}`,
        ai: m.sender === 'ai',
      };
    }
    const [code, arg = ''] = m.body.split(/:(.*)/s);
    switch (code) {
      case 'handoff':
        return {
          kind: 'event',
          id: m.id,
          tone: 'attention',
          text: t('events.handoff', { reason: arg }),
        };
      case 'takeover':
        return { kind: 'event', id: m.id, text: t('events.takeover') };
      case 'handback':
        return { kind: 'event', id: m.id, text: t('events.handback') };
      case 'ad_click':
        return {
          kind: 'event',
          id: m.id,
          text: t('events.adClick', {
            name: firstName,
            source: tSources(arg as 'instagram'),
            time,
          }),
        };
      case 'visit_booked': {
        const at = new Date(arg);
        return {
          kind: 'event',
          id: m.id,
          tone: 'success',
          text: t('events.visitBooked', {
            day: `${formatWeekdayShort(at).split(' ')[0]?.toLowerCase()} ${formatDayMonth(at)}`,
            time: formatTime(at),
          }),
        };
      }
      case 'qualification_saved':
        return {
          kind: 'event',
          id: m.id,
          text: compact
            ? t('events.qualificationSaved')
            : [
                t('events.qualificationSaved'),
                q.financingPct ? t('events.financing', { pct: q.financingPct }) : null,
                q.usesFgts ? t('events.fgts') : null,
                q.householdIncomeCents
                  ? t('events.income', {
                      amount: formatBRLShort(q.householdIncomeCents).replace('R$ ', ''),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(' · '),
        };
      default:
        return { kind: 'event', id: m.id, text: m.body };
    }
  });
}

/** Composer: "assume" input while the AI answers; the AI draft or a free reply when you are in control. */
export function ThreadComposer({
  detail,
  compact = false,
}: {
  detail: ConversationDetail;
  compact?: boolean;
}) {
  const t = useTranslations('conversation.composer');
  const { conversation, draft } = detail;
  const [text, setText] = useState('');
  const [draftText, setDraftText] = useState(draft?.body ?? '');
  const send = useAction(actions.sendMessage);
  const takeOver = useAction(actions.takeOver);
  const handBack = useAction(actions.handBack);
  const discard = useAction(actions.discardDraft);
  const busy = send.isPending || takeOver.isPending || handBack.isPending;

  if (conversation.aiMode !== 'handed_off') {
    return (
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate([conversation.id, text], { onSuccess: () => setText('') });
          else takeOver.mutate([conversation.id]);
        }}
      >
        <label htmlFor="assume-input" className="sr-only">
          {t('message')}
        </label>
        <input
          id="assume-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={compact ? t('assumePlaceholderShort') : t('assumePlaceholder')}
          className="h-11 min-w-0 flex-1 rounded-control border border-line bg-panel px-3 type-body placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-focus"
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          {compact ? (
            t('assumeShort')
          ) : (
            <>
              <span className="md:hidden">{t('assumeShort')}</span>
              <span className="hidden md:inline">{t('assume')}</span>
            </>
          )}
        </Button>
      </form>
    );
  }

  if (draft) {
    return (
      <AiDraftComposer
        badge={<Badge variant="ai">{t('draftBadge')}</Badge>}
        label={t('draftLabel')}
        value={draftText}
        onChange={setDraftText}
        warning={draft.warning}
        discard={
          <button
            type="button"
            onClick={() => discard.mutate([conversation.id])}
            className="type-body-s font-medium text-action underline underline-offset-2"
          >
            {t('discard')}
          </button>
        }
        actions={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => handBack.mutate([conversation.id])}
            >
              {t('handBack')}
            </Button>
            <Button
              disabled={busy || !draftText.trim()}
              loading={send.isPending}
              loadingLabel={t('sending')}
              onClick={() => send.mutate([conversation.id, draftText])}
            >
              {t('send')}
            </Button>
          </>
        }
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate([conversation.id, text], { onSuccess: () => setText('') });
      }}
    >
      <label htmlFor="reply-input" className="sr-only">
        {t('message')}
      </label>
      <textarea
        id="reply-input"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('replyPlaceholder')}
        className="w-full resize-y rounded-control border border-line bg-panel px-3 py-2 type-body placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-focus"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => handBack.mutate([conversation.id])}
        >
          {t('handBack')}
        </Button>
        <Button type="submit" disabled={busy || !text.trim()}>
          {t('send')}
        </Button>
      </div>
    </form>
  );
}

export function Thread({
  detail,
  compact = false,
  className,
  header,
  headerClassName,
}: {
  detail: ConversationDetail;
  compact?: boolean;
  className?: string;
  header?: React.ReactNode;
  headerClassName?: string;
}) {
  const t = useTranslations('conversation');
  const items = useChatItems(detail, compact);
  return (
    <ChatThread
      label={t('threadLabel', { name: detail.conversation.person.name })}
      items={items}
      header={header}
      headerClassName={headerClassName}
      footer={
        <ThreadComposer
          key={`${detail.conversation.id}-${detail.conversation.aiMode}-${detail.draft ? 1 : 0}`}
          detail={detail}
          compact={compact}
        />
      }
      className={className}
    />
  );
}
