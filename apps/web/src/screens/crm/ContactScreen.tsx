'use client';

import { Button, Input, Panel, StatusPill, Timeline, formatBRL, formatPhoneBR } from '@casvitta/ui';
import { Textarea } from '@casvitta/ui/backoffice';
import {
  CalendarCheck,
  MessageSquare,
  Repeat,
  Sparkles,
  StickyNote,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { DemoBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import {
  CrmError,
  useAddNote,
  useAddTask,
  useContact,
  useSetConsent,
  type Contact360,
} from '@/lib/data/crm';
import { formatDate, formatTime } from '@/lib/format';

import { CrmStates, useInterestLine, useStageName } from './shared';

const ICON = {
  message: MessageSquare,
  event: Repeat,
  note: StickyNote,
  visit: CalendarCheck,
} as const;

const stamp = (iso: string) => `${formatDate(new Date(iso))} · ${formatTime(new Date(iso))}`;

/** CR2 · Contato 360 (docs/mockups/crm/02-contact-360). */
export function ContactScreen({ id }: { id: string }) {
  const t = useTranslations('crm');
  const contact = useContact(id);
  return (
    <CrmStates query={contact} subject={t('contacts.subject')}>
      {(c) => <ContactView c={c} />}
    </CrmStates>
  );
}

function ContactView({ c }: { c: Contact360 }) {
  const t = useTranslations('crm');
  const stageName = useStageName();
  const interestLine = useInterestLine();
  const openLead = c.leads[0];
  const nextTask = c.tasks.find((task) => !task.done_at);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[t('contact.breadcrumb'), c.name]}
        title={c.name}
        subtitle={[t(`kind.${c.kind}`), t(`source.${c.source}`), c.source_detail]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Button asChild variant="secondary" icon={<MessageSquare aria-hidden="true" />}>
            <Link href={`/conversas?contato=${c.id}`}>{t('contact.openConversation')}</Link>
          </Button>
        }
      />
      {c.is_demo ? <DemoBadge className="self-start" /> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title={t('contact.timeline')}>
            <TimelineList c={c} />
            <NoteForm personId={c.id} />
          </Panel>
        </div>
        <aside className="flex flex-col gap-6">
          <Panel title={t('contact.details')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 type-body-s">
              <dt className="text-fg-muted">{t('channel.whatsapp')}</dt>
              <dd>{c.phone_e164 ? formatPhoneBR(c.phone_e164) : t('contact.notInformed')}</dd>
              <dt className="text-fg-muted">{t('channel.instagram')}</dt>
              <dd>{c.instagram_handle ? `@${c.instagram_handle}` : t('contact.notInformed')}</dd>
              <dt className="text-fg-muted">{t('channel.email')}</dt>
              <dd>{c.email ?? t('contact.notInformed')}</dd>
              <dt className="text-fg-muted">{t('contact.stage')}</dt>
              <dd>{openLead ? stageName(openLead.stage) : '—'}</dd>
              <dt className="text-fg-muted">{t('contact.nextAction')}</dt>
              <dd>
                {nextTask
                  ? [nextTask.title, nextTask.due_at ? stamp(nextTask.due_at) : null]
                      .filter(Boolean)
                      .join(' · ')
                  : t('contact.noNextAction')}
              </dd>
            </dl>
            <TaskForm personId={c.id} />
          </Panel>
          <Panel title={t('contact.preferences')}>
            {c.interests.length === 0 ? (
              <p className="type-body-s text-fg-muted">{t('contact.noPreferences')}</p>
            ) : (
              <ul className="flex flex-col gap-1 type-body-s">
                {c.interests.slice(0, 3).map((i) => (
                  <li key={i.id}>{interestLine(i)}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 type-caption">{t('contact.preferencesNote')}</p>
          </Panel>
          <Panel title={t('contact.matching')}>
            {c.matching_properties.length === 0 ? (
              <p className="type-body-s text-fg-muted">{t('contact.noMatching')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {c.matching_properties.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 type-body-s">
                    <span>
                      <span className="font-semibold">{p.title}</span>
                      <span className="block type-caption">
                        {p.code} · {formatBRL(p.price_cents)}
                      </span>
                    </span>
                    {!p.within_budget ? (
                      <StatusPill tone="neutral">{t('contact.overBudget')}</StatusPill>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <ConsentPanel c={c} />
        </aside>
      </div>
    </div>
  );
}

function TimelineList({ c }: { c: Contact360 }) {
  const t = useTranslations('crm');
  const items = c.timeline.map((item, i) => {
    const Icon = item.kind === 'message' && item.author === 'agent' ? Sparkles : ICON[item.kind];
    const title =
      item.kind === 'message'
        ? item.text
        : item.kind === 'note'
          ? item.text
          : item.kind === 'visit'
            ? t(`contact.visit.${item.text as 'confirmed'}`)
            : t(`contact.event.${item.text as 'contact_created'}`);
    const who =
      item.kind === 'note'
        ? t('contact.note')
        : [
            item.channel ? t(`channel.${item.channel as 'whatsapp'}`) : null,
            item.author ? t(`contact.author.${item.author as 'broker'}`) : null,
          ]
            .filter(Boolean)
            .join(' · ');
    return {
      key: `${item.kind}-${item.at}-${i}`,
      icon: <Icon aria-hidden="true" className="size-4" />,
      time: stamp(item.at),
      title,
      detail: who,
      tone: item.author === 'agent' ? ('action' as const) : ('neutral' as const),
    };
  });
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 type-body-s text-fg-muted">
        <UserRound aria-hidden="true" className="size-4" />
        {t(`contact.event.contact_created`)}
      </p>
    );
  }
  return <Timeline items={items} />;
}

function NoteForm({ personId }: { personId: string }) {
  const t = useTranslations('crm');
  const add = useAddNote(personId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await add.mutateAsync(body.trim());
      setBody('');
      setError(null);
    } catch {
      setError(t('errors.generic'));
    }
  };
  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
      <Textarea
        label={t('contact.noteLabel')}
        placeholder={t('contact.notePlaceholder')}
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? <p className="type-body-s text-danger">{error}</p> : null}
      <Button type="submit" variant="secondary" className="self-end" loading={add.isPending}>
        {t('contact.addNote')}
      </Button>
    </form>
  );
}

function TaskForm({ personId }: { personId: string }) {
  const t = useTranslations('crm');
  const add = useAddTask(personId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  if (!open) {
    return (
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        {t('contact.addTask')}
      </Button>
    );
  }
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await add.mutateAsync({ title, due_at: due ? new Date(due).toISOString() : null });
        setOpen(false);
        setTitle('');
        setDue('');
      }}
    >
      <Input
        label={t('contact.taskLabel')}
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        label={t('contact.taskDue')}
        type="datetime-local"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <Button type="submit" size="sm" className="self-end" loading={add.isPending}>
        {t('contact.saveTask')}
      </Button>
    </form>
  );
}

function ConsentPanel({ c }: { c: Contact360 }) {
  const t = useTranslations('crm');
  const set = useSetConsent(c.id);
  const [error, setError] = useState<string | null>(null);
  const rows = c.consents.filter((s) => s.purpose === 'contact_about_properties' || s.status);
  return (
    <Panel title={t('contact.consents')}>
      <ul className="flex flex-col gap-2 type-body-s">
        {rows.map((s) => (
          <li key={`${s.channel}-${s.purpose}`} className="flex flex-col">
            <span className="font-semibold">
              {t(`channel.${s.channel}`)} · {t(`purpose.${s.purpose}`)}
            </span>
            <span className={s.status === 'revoked' ? 'text-danger' : 'text-fg-muted'}>
              {s.status === 'granted' && s.occurred_at
                ? t('contact.consentGranted', {
                    date: formatDate(new Date(s.occurred_at)),
                    source: t(`contact.proof.${s.proof_source ?? 'broker'}`),
                  })
                : s.status === 'revoked' && s.occurred_at
                  ? t('contact.consentRevoked', { date: formatDate(new Date(s.occurred_at)) })
                  : t('contact.consentNever')}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 type-caption">{t('contact.sairNote')}</p>
      {c.consents.some((s) => s.channel === 'whatsapp' && s.status === 'granted') ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          loading={set.isPending}
          onClick={async () => {
            try {
              for (const purpose of ['contact_about_properties', 'marketing'] as const) {
                await set.mutateAsync({
                  channel: 'whatsapp',
                  purpose,
                  granted: false,
                  proof_source: 'broker',
                });
              }
            } catch (err) {
              setError(err instanceof CrmError && err.message ? err.message : t('errors.generic'));
            }
          }}
        >
          {t('contact.revoke')}
        </Button>
      ) : null}
      {error ? <p className="mt-2 type-body-s text-danger">{error}</p> : null}
    </Panel>
  );
}
