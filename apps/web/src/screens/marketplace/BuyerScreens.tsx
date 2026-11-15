'use client';

import {
  Avatar,
  Button,
  ChatThread,
  cn,
  EmptyState,
  PhotoPlaceholder,
  type ChatItem,
} from '@casvitta/ui';
import { Check, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { CreciBadge, DemoBadge } from '@/components/badges';
import type { AvailabilitySlot, BrokerProfile, Property } from '@/domain/types';
import { useAction } from '@/lib/data/hooks';
import { answerFromRecord, bookBuyerVisit } from '@/lib/data/marketplace';
import { formatDayMonth, formatDayMonthShort, formatLongDay, formatTime } from '@/lib/format';

type Line = { from: 'buyer' | 'ai'; text: string };

/** Mockup 25: the buyer talks to the broker's virtual assistant and picks a free slot. */
export function BuyerChat({
  property,
  broker,
  slots,
  script,
}: {
  property: Property;
  broker: BrokerProfile;
  slots: AvailabilitySlot[];
  /** Demo transcript up to the slot offer (fixture). */
  script: Line[];
}) {
  const t = useTranslations('buyer.chat');
  const router = useRouter();
  const book = useAction(bookBuyerVisit);
  const [extra, setExtra] = useState<Line[]>([]);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const firstName = broker.firstName;

  const items: ChatItem[] = useMemo(
    () => [
      { kind: 'event', id: 'virtual', text: t('virtualNotice') },
      ...[...script, ...extra].map((line, i): ChatItem => ({
        kind: 'message',
        id: `l${i}`,
        side: line.from === 'buyer' ? 'out' : 'in',
        text: line.text,
        meta: line.from === 'buyer' ? t('you') : t('assistant'),
        ai: line.from === 'ai',
      })),
    ],
    [script, extra, t],
  );

  const onPick = (slot: AvailabilitySlot) => {
    setPicked(slot.id);
    book.mutate(
      [
        property.slug,
        slot.id,
        { financingPct: 80, fgtsCents: 6_000_000, householdIncomeCents: 2_200_000 },
      ],
      {
        onSuccess: (startsAt) =>
          router.push(
            `/imovel/${property.slug}/visita-confirmada?horario=${encodeURIComponent(startsAt)}`,
          ),
      },
    );
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-56px)] max-w-2xl flex-col md:h-[calc(100dvh-68px)] md:py-6">
      <header className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2 md:rounded-t-card md:border-x md:border-t">
        <Link
          href={`/imovel/${property.slug}`}
          aria-label={t('back')}
          className="-ml-2 flex size-11 items-center justify-center"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.6} className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="type-body font-semibold">{t('title', { name: broker.displayName })}</h1>
          <p className="truncate type-caption">
            {t('subtitle', { state: broker.creciState, number: broker.creciNumber })}
          </p>
        </div>
        {property.isDemo ? <DemoBadge /> : null}
      </header>
      <ChatThread
        label={t('label', { name: broker.displayName })}
        items={items}
        className="min-h-0 flex-1 rounded-none border-0 md:rounded-b-card md:border md:border-t-0"
        footer={
          <div className="flex flex-col gap-3">
            {slots.length ? (
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('slotsLabel')}>
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={book.isPending}
                    onClick={() => onPick(slot)}
                    className={cn(
                      'min-h-12 rounded-control border font-mono type-body font-semibold',
                      picked === slot.id
                        ? 'border-2 border-action bg-action-subtle'
                        : 'border-line bg-panel hover:bg-canvas',
                    )}
                  >
                    {formatTime(new Date(slot.startsAt))}
                    <span className="sr-only">{` · ${formatLongDay(slot.startsAt)}`}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="type-body-s text-fg-muted">{t('noSlots', { name: firstName })}</p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const q = text.trim();
                if (!q) return;
                const answer = answerFromRecord(property, q);
                setExtra((list) => [
                  ...list,
                  { from: 'buyer', text: q },
                  {
                    from: 'ai',
                    text:
                      answer.kind === 'fact' && answer.source.startsWith('facts.')
                        ? answer.text
                        : t('handoff', { name: firstName }),
                  },
                ]);
                setText('');
              }}
            >
              <label htmlFor="buyer-input" className="sr-only">
                {t('message')}
              </label>
              <input
                id="buyer-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('placeholder')}
                className="h-11 min-w-0 flex-1 rounded-control border border-line bg-panel px-3 type-body-s focus-visible:outline-2 focus-visible:outline-focus"
              />
              <Button type="submit">{t('send')}</Button>
            </form>
          </div>
        }
      />
    </div>
  );
}

/** Mockup 26: confirmation for the buyer, with address, broker and reminders. */
export function VisitConfirmed({
  property,
  broker,
}: {
  property: Property;
  broker: BrokerProfile;
}) {
  const t = useTranslations('buyer.confirmed');
  const params = useSearchParams();
  const startsAt = params.get('horario');
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          actions={
            <Button asChild>
              <Link href={`/imovel/${property.slug}/conversa`}>{t('pickTime')}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const at = new Date(startsAt);
  const weekday = formatLongDay(at).split(',')[0] ?? '';
  const end = new Date(at.getTime() + 3600_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t('calendarTitle', { property: property.shortName }))}&dates=${fmt(at)}/${fmt(end)}&location=${encodeURIComponent(`${property.street}, ${property.neighborhood}, ${property.city}`)}`;
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${property.street}, ${property.neighborhood}, ${property.city}`)}`;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-6 pb-36">
      <div className="flex items-start justify-between">
        <span className="flex size-16 items-center justify-center rounded-pill bg-success-subtle text-success">
          <Check aria-hidden="true" strokeWidth={2} className="size-7" />
        </span>
        {property.isDemo ? <DemoBadge /> : null}
      </div>
      <h1 className="type-display-l">{t('title')}</h1>
      <section className="overflow-hidden rounded-card border border-line bg-panel">
        <PhotoPlaceholder caption={property.shortName} className="h-28 w-full" />
        <div className="flex flex-col gap-1 p-4">
          <p className="type-title text-[22px]">
            {t('when', { weekday, date: formatDayMonthShort(at), time: formatTime(at) })}
          </p>
          <p className="type-body-s">
            {[property.street, property.streetNumberHint, property.unit].filter(Boolean).join(', ')}
          </p>
          <p className="type-caption">
            {[
              property.neighborhood,
              property.nearby
                ? t('nearby', { distance: property.nearby.distanceM, place: property.nearby.label })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </section>
      <section className="flex items-center gap-3 rounded-card border border-line bg-panel p-4">
        <Avatar name={broker.displayName} size={48} />
        <div className="flex flex-col items-start gap-1">
          <p className="type-body-s font-semibold">{t('host', { name: broker.displayName })}</p>
          <CreciBadge broker={broker} />
        </div>
      </section>
      <ul className="flex list-disc flex-col gap-1 pl-5 type-body-s text-fg-strong">
        <li>{t('reminders', { day: formatDayMonth(new Date(at.getTime() - 86_400_000)) })}</li>
        <li>{t('bringId')}</li>
        <li>{t('reschedule')}</li>
      </ul>
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 border-t border-line bg-panel px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:p-0">
        <Button asChild>
          <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
            {t('addToCalendar')}
          </a>
        </Button>
        <Button asChild variant="secondary">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            {t('directions')}
          </a>
        </Button>
      </div>
    </div>
  );
}
