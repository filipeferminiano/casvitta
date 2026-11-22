'use client';

import { Button, Callout, SegmentedControl, StatusPill, cn } from '@casvitta/ui';
import { Textarea } from '@casvitta/ui/backoffice';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { DemoBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import {
  CrmError,
  useInbox,
  useReply,
  useTakeOver,
  useThread,
  type InboxItem,
  type Thread,
} from '@/lib/data/crm';
import { formatTime } from '@/lib/format';

import { CrmStates, useAgo } from './shared';

/** AU6 · Caixa de entrada (docs/mockups/crm/15-inbox; 18/19 on phones: list, then the thread). */
export function InboxScreen() {
  const t = useTranslations('crm');
  const router = useRouter();
  const params = useSearchParams();
  const [needsYou, setNeedsYou] = useState(false);
  const inbox = useInbox(needsYou);
  // From Contato 360 ("Abrir conversa"): the contact's most recent conversation.
  const forContact = params.get('contato');
  const selected =
    params.get('c') ?? inbox.data?.find((c) => c.person_id === forContact)?.id ?? null;
  const ago = useAgo();

  const open = (id: string) => router.replace(`/conversas?c=${id}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('inbox.title')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className={cn('flex flex-col gap-3', selected && 'hidden lg:flex')}>
          <SegmentedControl
            label={t('inbox.title')}
            value={needsYou ? 'needs' : 'all'}
            onValueChange={(v) => setNeedsYou(v === 'needs')}
            options={[
              { value: 'all', label: t('inbox.all') },
              { value: 'needs', label: t('inbox.needsYou') },
            ]}
          />
          <CrmStates
            query={inbox}
            subject={t('inbox.subject')}
            isEmpty={(d) => d.length === 0}
            empty={{ title: t('inbox.empty') }}
          >
            {(items) => (
              <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-panel">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => open(c.id)}
                      aria-current={c.id === selected ? 'true' : undefined}
                      className={cn(
                        'flex min-h-11 w-full flex-col gap-1 px-4 py-3 text-left hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus',
                        c.id === selected && 'bg-action-subtle',
                        c.ai_mode === 'handed_off' && 'border-l-4 border-attention',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{c.person_name}</span>
                        <span className="type-caption">
                          {c.last_message_at ? ago(c.last_message_at) : ''}
                        </span>
                      </span>
                      <span className="line-clamp-1 type-body-s text-fg-muted">
                        {t(`channel.${c.channel}`)} · {c.last_message ?? ''}
                      </span>
                      <span className="flex gap-2">
                        {c.unread_count > 0 ? (
                          <StatusPill tone="info">
                            {t('inbox.unread', { count: c.unread_count })}
                          </StatusPill>
                        ) : null}
                        {c.is_demo ? <DemoBadge /> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CrmStates>
        </section>
        <section className={cn(!selected && 'hidden lg:block')}>
          {selected ? (
            <ThreadPane id={selected} onBack={() => router.replace('/conversas')} />
          ) : (
            <p className="type-body text-fg-muted">{t('inbox.pick')}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadPane({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslations('crm');
  const thread = useThread(id);
  return (
    <CrmStates query={thread} subject={t('inbox.subject')}>
      {(data) => <ThreadView data={data} onBack={onBack} />}
    </CrmStates>
  );
}

function ThreadView({ data, onBack }: { data: Thread; onBack: () => void }) {
  const t = useTranslations('crm');
  const c: InboxItem = data.conversation;
  const takeOver = useTakeOver(c.id);
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-panel p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={onBack}>
            {t('inbox.title')}
          </Button>
          <h2 className="type-title">{c.person_name}</h2>
          <span className="type-caption">{t(`channel.${c.channel}`)}</span>
        </div>
        <Link href={`/contatos/${c.person_id}`} className="type-body-s font-semibold text-action">
          {t('inbox.openContact')}
        </Link>
      </header>
      {c.ai_mode === 'handed_off' ? (
        <Callout tone="attention">
          {t('inbox.handedOff', { reason: c.handoff_reason ?? '' })}
        </Callout>
      ) : null}
      {c.ai_mode === 'active' ? (
        <Callout tone="info">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {t('inbox.botActive')}
            <Button size="sm" loading={takeOver.isPending} onClick={() => takeOver.mutate()}>
              {t('inbox.takeOver')}
            </Button>
          </span>
        </Callout>
      ) : null}
      <ol className="flex flex-col gap-3" aria-live="polite">
        {data.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              'max-w-[85%] rounded-card px-3 py-2 type-body-s',
              m.direction === 'inbound' ? 'self-start bg-subtle' : 'self-end bg-action-subtle',
            )}
          >
            {m.author === 'agent' ? (
              <span className="mb-1 flex items-center gap-1 type-caption text-action">
                <Sparkles aria-hidden="true" className="size-3" />
                {t('contact.author.agent')}
              </span>
            ) : null}
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 text-right type-caption">
              {formatTime(new Date(m.sent_at))}
              {m.status === 'queued' ? ` · ${t('inbox.queued')}` : ''}
              {m.status === 'failed' ? ` · ${t('inbox.failed')}` : ''}
            </p>
          </li>
        ))}
      </ol>
      {c.channel === 'page' ? (
        <Callout tone="info">{t('inbox.pageForm')}</Callout>
      ) : c.window_open ? (
        <Composer conversationId={c.id} />
      ) : (
        <Callout tone="attention">{t('inbox.windowClosed')}</Callout>
      )}
    </div>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const t = useTranslations('crm');
  const reply = useReply(conversationId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await reply.mutateAsync(body.trim());
      setBody('');
      setError(null);
    } catch (err) {
      setError(err instanceof CrmError && err.message ? err.message : t('inbox.sendError'));
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line pt-3">
      <Textarea
        label={t('inbox.composer')}
        value={body}
        maxLength={4096}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? <p className="type-body-s text-danger">{error}</p> : null}
      <Button
        type="submit"
        className="self-end"
        loading={reply.isPending}
        loadingLabel={t('inbox.sending')}
      >
        {t('inbox.send')}
      </Button>
    </form>
  );
}
