'use client';

import { Button, CalendarWeek, Checkbox, Panel, StatusPill } from '@casvitta/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import type { AppointmentView } from '@/lib/data/calendar';
import { useAppointment, useWeek } from '@/lib/data/hooks';
import {
  formatDayMonthLong,
  formatDayMonthShort,
  formatLongDay,
  formatTime,
  formatWeekdayShort,
} from '@/lib/format';

import { dayKey, weekToGrid } from './calendar-items';

/** Mockup 16: the week around a booked visit + the confirmation and reminder schedule. */
export function VisitScreen({ appointmentId }: { appointmentId: string }) {
  const t = useTranslations('visit');
  const query = useAppointment(appointmentId);
  return (
    <ScreenStates
      query={query}
      subject={t('subject')}
      empty={{ title: t('notFoundTitle'), description: t('notFoundDescription') }}
    >
      {(appointment) => <VisitLayout appointment={appointment} />}
    </ScreenStates>
  );
}

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00-03:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d.toISOString());
}

function VisitLayout({ appointment }: { appointment: AppointmentView }) {
  const t = useTranslations('visit');
  const tAgenda = useTranslations('agenda');
  const tNav = useTranslations('nav');
  const day = dayKey(appointment.startsAt);
  const start = addDays(day, -2);
  const week = useWeek(start, 4);
  const [notifyOwner, setNotifyOwner] = useState(true);
  const at = new Date(appointment.startsAt);
  const weekday = formatLongDay(at).split(',')[0]?.toLowerCase() ?? '';
  const lead = appointment.lead;
  const property = lead?.property;
  const firstName = lead?.person.name.split(' ')[0] ?? '';

  const reminderLabel = (iso: string, index: number) => {
    if (index === 0) return t('now');
    const d = new Date(iso);
    return `${formatWeekdayShort(d).split(' ')[0]?.toLowerCase()} ${formatTime(d)}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[tNav('calendar'), tAgenda('week')]}
        title={t('title', { weekday, time: formatTime(at) })}
        mobileTitle={t('mobileTitle')}
        mobileBack="/agenda"
        subtitle={
          appointment.bookedByAi
            ? t('subtitleAi', { name: firstName })
            : t('subtitle', { name: firstName })
        }
        demo
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          className="hidden md:block"
          title={tAgenda('range', {
            from: formatDayMonthLong(`${start}T12:00:00-03:00`).split(' ')[0] ?? '',
            to: formatDayMonthLong(`${addDays(start, 3)}T12:00:00-03:00`),
          })}
          aside={<span className="type-caption">{t('legendFree')}</span>}
        >
          {week.data ? (
            <CalendarWeek
              label={tAgenda('gridLabel')}
              days={week.data.days.map((d) => ({
                key: d,
                label: formatWeekdayShort(`${d}T12:00:00-03:00`),
              }))}
              {...weekToGrid(
                week.data,
                {
                  free: tAgenda('free'),
                  blocked: tAgenda('blocked'),
                  unavailable: tAgenda('unavailable'),
                },
                { selectedId: appointment.id, joinTitle: true },
              )}
              renderLink={(href, className, children) => (
                <Link href={href} className={className}>
                  {children}
                </Link>
              )}
            />
          ) : null}
        </Panel>

        <Panel
          title={appointment.status === 'cancelled' ? t('cancelled') : t('confirmedTitle')}
          aside={
            appointment.status === 'confirmed' || appointment.status === 'done' ? (
              <StatusPill tone="success">{t('confirmedByLead')}</StatusPill>
            ) : null
          }
        >
          <p className="type-title text-[24px]">
            {t('when', {
              day: formatWeekdayShort(at).split(' ')[0] ?? '',
              date: formatDayMonthShort(at),
              time: formatTime(at),
            })}
          </p>
          <p className="type-body-s text-fg-strong">{`${lead?.person.name ?? ''} · ${appointment.propertyShortName}`}</p>
          {property ? (
            <p className="type-caption">
              {[property.street, property.streetNumberHint, property.unit]
                .filter(Boolean)
                .join(', ')}
            </p>
          ) : null}
          {appointment.reminders.length ? (
            <ol className="mt-4 divide-y divide-line border-y border-line">
              {appointment.reminders.map((r, i) => (
                <li key={r.kind} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-2.5">
                  <span className="font-mono type-caption">{reminderLabel(r.at, i)}</span>
                  <span className="type-body-s text-fg-strong">
                    {t(`reminders.${r.kind}`, { name: firstName })}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          <Checkbox
            className="mt-2"
            label={t('notifyOwner')}
            checked={notifyOwner}
            onCheckedChange={(v) => setNotifyOwner(v === true)}
          />
          <div className="mt-2 flex flex-wrap gap-3">
            {appointment.reportId ? (
              <Button asChild>
                <Link href={`/anuncios/relatorios/${appointment.reportId}`}>{t('seeReport')}</Link>
              </Button>
            ) : null}
            {lead?.conversationId ? (
              <Button asChild variant="secondary">
                <Link href={`/conversas/${lead.conversationId}`}>{t('reschedule')}</Link>
              </Button>
            ) : null}
          </div>
          {appointment.bookedByAi ? (
            <p className="mt-4 border-t border-line pt-3 type-caption">{t('movedInCrm')}</p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
