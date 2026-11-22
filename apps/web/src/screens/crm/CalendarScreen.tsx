'use client';

import { Button, Callout, Input, Panel, Select, StatusPill } from '@casvitta/ui';
import { Dialog } from '@casvitta/ui/backoffice';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';

import { DemoBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import {
  CrmError,
  useBlockTime,
  useBookVisit,
  useCalendarSettings,
  useContacts,
  useSaveCalendarSettings,
  useSlots,
  useWeek,
  type CalendarSettings,
  type WeekData,
} from '@/lib/data/crm';
import { formatDayMonth, formatTime, formatWeekdayShort } from '@/lib/format';

import { CrmStates } from './shared';

const TZ = 'America/Sao_Paulo';

/** Monday of the week that contains `day`, as yyyy-MM-dd in São Paulo. */
function mondayOf(day: Date): string {
  const local = new Date(day.toLocaleString('en-US', { timeZone: TZ }));
  const offset = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - offset);
  return local.toLocaleDateString('en-CA');
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

/** AG4 · Agenda de visitas (docs/mockups/crm/23-visit-calendar). */
export function CalendarScreen() {
  const t = useTranslations('crm.calendar');
  const [start, setStart] = useState(() => mondayOf(new Date()));
  const week = useWeek(start);
  const [booking, setBooking] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const end = addDays(start, 6);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBlocking(true)}>
              {t('block')}
            </Button>
            <Button icon={<Plus aria-hidden="true" />} onClick={() => setBooking(true)}>
              {t('book')}
            </Button>
          </div>
        }
      />
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('prev')}
          icon={<ChevronLeft aria-hidden="true" />}
          onClick={() => setStart(addDays(start, -7))}
        />
        <p className="type-title">
          {t('week', {
            start: formatDayMonth(`${start}T12:00:00-03:00`),
            end: formatDayMonth(`${end}T12:00:00-03:00`),
          })}
        </p>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('next')}
          icon={<ChevronRight aria-hidden="true" />}
          onClick={() => setStart(addDays(start, 7))}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CrmStates query={week} subject={t('subject')} feature="calendar">
          {(data) => <WeekView start={start} data={data} />}
        </CrmStates>
        <RulesPanel />
      </div>
      {booking ? <BookDialog onClose={() => setBooking(false)} /> : null}
      {blocking ? <BlockDialog onClose={() => setBlocking(false)} /> : null}
    </div>
  );
}

function WeekView({ start, data }: { start: string; data: WeekData }) {
  const t = useTranslations('crm.calendar');
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <ol className="grid gap-3 md:grid-cols-7">
      {days.map((day) => {
        const visits = data.visits.filter((v) => dayKey(v.starts_at) === day);
        const blocks = data.blocks.filter((b) => dayKey(b.starts_at) === day);
        const free = data.free.filter((s) => dayKey(s.starts_at) === day);
        const date = `${day}T12:00:00-03:00`;
        return (
          <li
            key={day}
            className="flex flex-col gap-2 rounded-card border border-line bg-panel p-3"
          >
            <p className="type-body-s font-semibold">
              {formatWeekdayShort(date)} {formatDayMonth(date)}
            </p>
            {visits.map((v) => (
              <div key={v.id} className="rounded-control bg-action-subtle px-2 py-1 type-caption">
                <span className="font-semibold">{formatTime(new Date(v.starts_at))}</span>{' '}
                {t('visit', { name: v.person_name })}
                {v.property_code ? ` · ${v.property_code}` : ''}
                <span className="block">
                  <StatusPill tone={v.status === 'cancelled' ? 'neutral' : 'info'}>
                    {t(`status.${v.status}`)}
                  </StatusPill>
                  {v.is_demo ? <DemoBadge /> : null}
                </span>
              </div>
            ))}
            {blocks.map((b) => (
              <div key={b.id} className="rounded-control bg-subtle px-2 py-1 type-caption">
                {formatTime(new Date(b.starts_at))}–{formatTime(new Date(b.ends_at))} · {t('busy')}
              </div>
            ))}
            {free.length > 0 ? (
              <p className="type-caption text-success">
                {free.length} {t('free')} · {formatTime(new Date(free[0]!.starts_at))}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function RulesPanel() {
  const t = useTranslations('crm.calendar');
  const settings = useCalendarSettings();
  return (
    <Panel title={t('rules')}>
      <CrmStates query={settings} subject={t('subject')} feature="calendar">
        {(data) => <RulesForm initial={data} />}
      </CrmStates>
      <p className="mt-3 type-caption">{t('privacy')}</p>
    </Panel>
  );
}

function RulesForm({ initial }: { initial: CalendarSettings }) {
  const t = useTranslations('crm.calendar');
  const save = useSaveCalendarSettings();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const num = (key: keyof CalendarSettings, label: string) => (
    <Input
      label={label}
      type="number"
      inputMode="numeric"
      min={0}
      value={String(form[key] as number)}
      onChange={(e) => {
        setSaved(false);
        setForm({ ...form, [key]: Number(e.target.value) });
      }}
    />
  );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await save.mutateAsync(form);
        setSaved(true);
      }}
    >
      {num('visit_minutes', t('visitMinutes'))}
      {num('buffer_minutes', t('bufferMinutes'))}
      {num('other_neighborhood_buffer_minutes', t('otherBuffer'))}
      {num('lead_time_minutes', t('leadTime'))}
      {num('days_ahead', t('daysAhead'))}
      {saved ? <p className="type-body-s text-success">{t('saved')}</p> : null}
      <Button type="submit" className="self-end" loading={save.isPending}>
        {t('save')}
      </Button>
    </form>
  );
}

function BookDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('crm.calendar');
  const tCrm = useTranslations('crm');
  const contacts = useContacts('all', '');
  const slots = useSlots(null);
  const book = useBookVisit();
  const [personId, setPersonId] = useState('');
  const [slot, setSlot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const slotOptions = useMemo(
    () =>
      (slots.data ?? []).slice(0, 60).map((s) => ({
        value: s.starts_at,
        label: `${formatWeekdayShort(s.starts_at)} ${formatDayMonth(s.starts_at)} · ${formatTime(new Date(s.starts_at))}`,
      })),
    [slots.data],
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await book.mutateAsync({ person_id: personId, starts_at: slot });
      onClose();
    } catch (err) {
      setError(
        err instanceof CrmError && err.code === 'slot_taken'
          ? t('slotTaken')
          : err instanceof CrmError && err.message
            ? err.message
            : tCrm('errors.generic'),
      );
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('bookTitle')}
      closeLabel={tCrm('newContact.cancel')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Select
          label={t('bookContact')}
          required
          value={personId}
          onValueChange={setPersonId}
          options={(contacts.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        {slots.data && slots.data.length === 0 ? (
          <Callout tone="attention">{t('noSlots')}</Callout>
        ) : (
          <Select
            label={t('bookSlot')}
            required
            value={slot}
            onValueChange={setSlot}
            options={slotOptions}
          />
        )}
        {error ? <p className="type-body-s text-danger">{error}</p> : null}
        <Button
          type="submit"
          className="self-end"
          disabled={!personId || !slot}
          loading={book.isPending}
        >
          {t('bookConfirm')}
        </Button>
      </form>
    </Dialog>
  );
}

function BlockDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('crm.calendar');
  const tCrm = useTranslations('crm');
  const block = useBlockTime();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('blockTitle')}
      closeLabel={tCrm('newContact.cancel')}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await block.mutateAsync({
              starts_at: new Date(from).toISOString(),
              ends_at: new Date(to).toISOString(),
            });
            onClose();
          } catch (err) {
            setError(err instanceof CrmError && err.message ? err.message : tCrm('errors.generic'));
          }
        }}
      >
        <Input
          label={t('blockStart')}
          type="datetime-local"
          required
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label={t('blockEnd')}
          type="datetime-local"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        {error ? <p className="type-body-s text-danger">{error}</p> : null}
        <Button type="submit" className="self-end" loading={block.isPending}>
          {t('blockConfirm')}
        </Button>
      </form>
    </Dialog>
  );
}
