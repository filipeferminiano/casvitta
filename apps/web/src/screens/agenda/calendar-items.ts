import type { CalendarItem } from '@casvitta/ui';

import type { AppointmentView, Week } from '@/lib/data/calendar';
import { formatTime } from '@/lib/format';

const TZ = 'America/Sao_Paulo';

/** "2026-11-16" in São Paulo time. */
export const dayKey = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));

type Copy = { free: string; blocked: string; unavailable: string };

export function appointmentState(a: AppointmentView, selectedId?: string): CalendarItem['state'] {
  if (a.id === selectedId) return 'selected';
  if (a.kind === 'task') return 'task';
  if (a.status === 'done') return 'done';
  return a.status === 'confirmed' ? 'confirmed' : 'awaiting';
}

/** Week data -> grid rows and items (only times that have something, as in the mockups). */
export function weekToGrid(
  week: Week,
  copy: Copy,
  options: { selectedId?: string; joinTitle?: boolean } = {},
) {
  const items: (CalendarItem & { at: string })[] = [
    ...week.slots.map((s) => ({
      id: s.id,
      at: s.startsAt,
      day: dayKey(s.startsAt),
      row: formatTime(new Date(s.startsAt)),
      state: s.kind === 'blocked' ? ('blocked' as const) : ('free' as const),
      title: s.kind === 'blocked' ? (s.label ? copy.blocked : copy.unavailable) : copy.free,
      subtitle: s.kind === 'blocked' ? (s.label ?? undefined) : undefined,
    })),
    ...week.appointments.map((a) => {
      const [taskTitle] = (a.title ?? '').split(' · ');
      const name = a.lead?.person.name ?? '';
      const title =
        a.kind === 'task'
          ? taskTitle
          : options.joinTitle
            ? `${name} · ${a.propertyShortName}`
            : name;
      const subtitle =
        a.kind === 'task'
          ? a.propertyShortName
          : options.joinTitle
            ? undefined
            : (a.title ?? a.propertyShortName);
      return {
        id: a.id,
        at: a.startsAt,
        day: dayKey(a.startsAt),
        row: formatTime(new Date(a.startsAt)),
        state: appointmentState(a, options.selectedId),
        title,
        subtitle,
        href: a.kind === 'visit' ? `/agenda/visitas/${a.id}` : undefined,
      };
    }),
  ];
  const rowKeys = [...new Map(items.map((i) => [i.row, i.at.slice(11, 16)])).entries()].sort(
    (a, b) => a[1].localeCompare(b[1]),
  );
  return {
    // Grid labels are zero-padded like the mockups: "09h", "11h30".
    rows: rowKeys.map(([key]) => ({ key, label: key.replace(/^(\d)h/, '0$1h') })),
    items,
  };
}
