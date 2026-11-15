'use client';

import {
  Button,
  CalendarWeek,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Panel,
  PanelList,
  StatusPill,
  useToast,
} from '@casvitta/ui';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import { todayISO, type AppointmentView, type Week } from '@/lib/data/calendar';
import { actions, useAction, useWeek } from '@/lib/data/hooks';
import { formatDayMonthLong, formatLongDay, formatTime, formatWeekdayShort } from '@/lib/format';

import { dayKey, weekToGrid } from './calendar-items';

export function AgendaScreen() {
  const t = useTranslations('agenda');
  const today = todayISO();
  const query = useWeek(today, 5);
  const setAiCanBook = useAction(actions.setAiCanBook);
  const blockSlot = useAction(actions.blockSlot);
  const toast = useToast();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[t('title'), t('week')]}
        title={t('title')}
        subtitle={
          query.data
            ? t('subtitle', { visits: query.data.visitCount, byAi: query.data.bookedByAi })
            : undefined
        }
        actions={
          query.data ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">{t('block')}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{t('blockMenuLabel')}</DropdownMenuLabel>
                {query.data.slots.filter((s) => s.kind === 'free_for_ai').length === 0 ? (
                  <DropdownMenuItem disabled>{t('noFreeSlots')}</DropdownMenuItem>
                ) : null}
                {query.data.slots
                  .filter((s) => s.kind === 'free_for_ai')
                  .map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onSelect={() =>
                        blockSlot.mutate([s.id], {
                          onSuccess: () =>
                            toast({
                              title: t('blockedToast', {
                                when: `${formatWeekdayShort(s.startsAt)} · ${formatTime(new Date(s.startsAt))}`,
                              }),
                            }),
                        })
                      }
                    >
                      {`${formatWeekdayShort(s.startsAt)} · ${formatTime(new Date(s.startsAt))}`}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
        demo
      />
      <ScreenStates
        query={query}
        subject={t('subject')}
        isEmpty={(w) => w.appointments.length === 0 && w.slots.length === 0}
        empty={{
          icon: <CalendarDays strokeWidth={1.6} />,
          title: t('emptyTitle'),
          description: t('emptyDescription'),
        }}
      >
        {(week) => {
          const grid = weekToGrid(week, {
            free: t('free'),
            blocked: t('blocked'),
            unavailable: t('unavailable'),
          });
          const todays = week.appointments
            .filter((a) => dayKey(a.startsAt) === today)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <>
              <div className="hidden gap-5 md:grid xl:grid-cols-[minmax(0,1fr)_300px]">
                <Panel
                  title={t('range', {
                    from: formatDayMonthLong(`${week.days[0]}T12:00:00-03:00`).split(' ')[0] ?? '',
                    to: formatDayMonthLong(`${week.days.at(-1)}T12:00:00-03:00`),
                  })}
                  aside={<Legend />}
                >
                  <CalendarWeek
                    label={t('gridLabel')}
                    days={week.days.map((d) => ({
                      key: d,
                      label: formatWeekdayShort(`${d}T12:00:00-03:00`),
                      isToday: d === today,
                    }))}
                    rows={grid.rows}
                    items={grid.items}
                    renderLink={(href, className, children) => (
                      <Link href={href} className={className}>
                        {children}
                      </Link>
                    )}
                  />
                </Panel>
                <div className="flex flex-col gap-5">
                  <TodayPanel items={todays} />
                  <Panel title={t('aiSlots.title')}>
                    <Checkbox
                      label={t('aiSlots.canBook')}
                      checked={week.aiCanBook}
                      onCheckedChange={(v) => setAiCanBook.mutate([v === true])}
                      className="border-t border-line pt-2"
                    />
                    <p className="mt-2 type-body-s text-fg-strong">{t('aiSlots.note')}</p>
                  </Panel>
                </div>
              </div>
              <MobileDay week={week} today={today} />
            </>
          );
        }}
      </ScreenStates>
    </div>
  );
}

function Legend() {
  const t = useTranslations('agenda.legend');
  return (
    <ul className="hidden items-center gap-4 type-caption lg:flex">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-1 rounded-pill bg-action" />
        {t('confirmed')}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-1 rounded-pill bg-attention" />
        {t('awaiting')}
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-[2px] border border-dashed border-fg-muted"
        />
        {t('free')}
      </li>
    </ul>
  );
}

function statusOf(a: AppointmentView): {
  tone: 'success' | 'neutral' | 'attention';
  key: 'confirmed' | 'task' | 'awaiting';
} {
  if (a.kind === 'task') return { tone: 'neutral', key: 'task' };
  return a.status === 'confirmed'
    ? { tone: 'success', key: 'confirmed' }
    : { tone: 'attention', key: 'awaiting' };
}

function TodayPanel({ items }: { items: AppointmentView[] }) {
  const t = useTranslations('agenda.today');
  return (
    <Panel title={t('title', { count: items.length })} flush>
      <PanelList className="mx-5 mb-2">
        {items.map((a) => {
          const status = statusOf(a);
          return (
            <li key={a.id} className="flex flex-col gap-1 py-4">
              <div className="flex items-center justify-between">
                <span className="font-mono type-body font-semibold">
                  {formatTime(new Date(a.startsAt))}
                </span>
                <StatusPill tone={status.tone}>{t(`status.${status.key}`)}</StatusPill>
              </div>
              <p className="type-body-s font-semibold">
                {a.kind === 'task' ? a.title?.split(' · ')[0] : a.lead?.person.name}
                {' · '}
                {a.propertyShortName}
              </p>
              {a.note ? <p className="type-caption">{a.note}</p> : null}
            </li>
          );
        })}
      </PanelList>
    </Panel>
  );
}

/** Phone: day strip + the selected day's list (mockup 37). */
function MobileDay({ week, today }: { week: Week; today: string }) {
  const t = useTranslations('agenda');
  const [day, setDay] = useState(today);
  const items = week.appointments
    .filter((a) => dayKey(a.startsAt) === day)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const awaiting = items.find((a) => a.kind === 'visit' && a.status === 'proposed');
  return (
    <div className="flex flex-col gap-4 md:hidden">
      <div
        role="tablist"
        aria-label={t('daysLabel')}
        className="-mx-4 grid grid-cols-5 gap-1 border-b border-line bg-panel px-3 pb-3"
      >
        {week.days.map((d) => {
          const date = `${d}T12:00:00-03:00`;
          const [weekday, num] = formatWeekdayShort(date).split(' ');
          const count = week.appointments.filter((a) => dayKey(a.startsAt) === d).length;
          const selected = d === day;
          return (
            <button
              key={d}
              role="tab"
              aria-selected={selected}
              onClick={() => setDay(d)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center rounded-control',
                selected ? 'bg-action text-white' : 'text-fg',
              )}
            >
              <span className="text-[12px] lowercase">{weekday}</span>
              <span className="font-mono text-[17px] font-semibold">{num}</span>
              <span aria-hidden="true" className="h-2 text-[10px] leading-2 tracking-tighter">
                {'•'.repeat(Math.min(count, 3))}
              </span>
              <span className="sr-only">{t('countLabel', { count })}</span>
            </button>
          );
        })}
      </div>
      <h2 className="type-body font-semibold">
        {day === today
          ? t('mobile.todayTitle', {
              weekday: formatLongDay(`${day}T12:00:00-03:00`).split(',')[0]?.toLowerCase() ?? '',
              count: items.length,
            })
          : t('mobile.dayTitle', {
              day: formatDayMonthLong(`${day}T12:00:00-03:00`),
              count: items.length,
            })}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((a) => (
          <MobileCard key={a.id} a={a} />
        ))}
      </ul>
      {awaiting ? (
        <p className="type-body-s text-fg-strong">
          {t('mobile.awaitingNote', {
            name: awaiting.lead?.person.name.split(' ')[0] ?? '',
            time: formatTime(new Date(new Date(awaiting.startsAt).getTime() - 2 * 3600_000)),
          })}
        </p>
      ) : null}
    </div>
  );
}

function MobileCard({ a }: { a: AppointmentView }) {
  const t = useTranslations('agenda.mobile');
  const tToday = useTranslations('agenda.today.status');
  const status = statusOf(a);
  const border =
    a.kind === 'task'
      ? 'border-l-ink-300'
      : a.status === 'confirmed'
        ? 'border-l-action'
        : 'border-l-attention';
  const action =
    a.kind === 'task'
      ? { label: t('seeProperty'), href: '/imoveis' }
      : a.status === 'confirmed'
        ? {
            label: t('directions'),
            href: `https://www.google.com/maps/search/${encodeURIComponent(`${a.propertyShortName}, São Paulo`)}`,
          }
        : { label: t('call'), href: `tel:${a.lead?.person.phoneE164 ?? ''}` };
  return (
    <li className="flex gap-4">
      <span className="w-10 shrink-0 pt-3 font-mono type-body font-semibold">
        {formatTime(new Date(a.startsAt))}
      </span>
      <div
        className={cn(
          'flex flex-1 flex-col items-start gap-1 rounded-card border border-line border-l-4 bg-panel p-3',
          border,
        )}
      >
        <p className="type-body font-semibold">
          {a.kind === 'task' ? a.title : a.lead?.person.name}
        </p>
        <p className="type-body-s text-fg-muted">
          {a.propertyShortName}
          {' · '}
          {a.kind === 'task'
            ? (a.note?.toLocaleLowerCase('pt-BR') ?? '')
            : tToday(status.key).toLowerCase()}
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <a href={action.href}>{action.label}</a>
        </Button>
      </div>
    </li>
  );
}
