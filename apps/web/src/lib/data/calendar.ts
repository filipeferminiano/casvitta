import type { Appointment, AvailabilitySlot } from '@/domain/types';
import { now } from '@/mocks/clock';

import { withScreenState } from './screen-state';
import { db, mutate, newId } from './store';
import { byId, leadView, type LeadView } from './views';

export type AppointmentView = Appointment & {
  lead: LeadView | null;
  propertyShortName: string;
  /** Latest weekly report of the property's campaign, if any. */
  reportId: string | null;
};

export type Week = {
  days: string[]; // ISO dates (yyyy-mm-dd), Monday first
  slots: AvailabilitySlot[];
  appointments: AppointmentView[];
  visitCount: number;
  bookedByAi: number;
  aiCanBook: boolean;
};

const dayKey = (iso: string) => iso.slice(0, 10);
const shift = (iso: string, hours: number) =>
  new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();

function appointmentView(appointment: Appointment): AppointmentView {
  const data = db();
  const lead = appointment.leadId ? data.leads.find((l) => l.id === appointment.leadId) : null;
  return {
    ...appointment,
    lead: lead ? leadView(lead, data) : null,
    propertyShortName: byId(data.properties, appointment.propertyId).shortName,
    reportId:
      data.reports
        .filter((r) => r.propertyId === appointment.propertyId)
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0]?.id ?? null,
  };
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00-03:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Days shown in the week grid (the mockups show working days: Mon–Fri, or Thu–Sun). */
export function getWeek(start: string, length = 5): Promise<Week> {
  const days = Array.from({ length }, (_, i) => addDays(start, i));
  const allWeek = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return withScreenState<Week>(
    { days, slots: [], appointments: [], visitCount: 0, bookedByAi: 0, aiCanBook: true },
    () => {
      const data = db();
      const inDays = (iso: string) => days.includes(dayKey(iso));
      const weekVisits = data.appointments.filter(
        (a) =>
          a.kind === 'visit' && a.status !== 'cancelled' && allWeek.includes(dayKey(a.startsAt)),
      );
      // A free slot taken by an appointment is no longer offered.
      const taken = new Set(data.appointments.map((a) => a.startsAt));
      return {
        days,
        slots: data.slots.filter((s) => inDays(s.startsAt) && !taken.has(s.startsAt)),
        appointments: data.appointments.filter((a) => inDays(a.startsAt)).map(appointmentView),
        visitCount: weekVisits.length,
        bookedByAi: weekVisits.filter((a) => a.bookedByAi).length,
        aiCanBook: data.aiCanBook,
      };
    },
  );
}

export function getDay(day: string): Promise<AppointmentView[]> {
  return withScreenState<AppointmentView[]>([], () =>
    db()
      .appointments.filter((a) => dayKey(a.startsAt) === day && a.status !== 'cancelled')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(appointmentView),
  );
}

export function getAppointment(appointmentId: string): Promise<AppointmentView | null> {
  return withScreenState<AppointmentView | null>(null, () => {
    const appointment = db().appointments.find((a) => a.id === appointmentId);
    return appointment ? appointmentView(appointment) : null;
  });
}

export function todayISO(): string {
  return new Date(now().getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Turns a free-for-AI slot into a blocked one ("Bloquear horário"). */
export async function blockSlot(slotId: string): Promise<void> {
  mutate((data) => {
    const slot = byId(data.slots, slotId);
    slot.kind = 'blocked';
    slot.label = null;
  });
}

export async function setAiCanBook(enabled: boolean): Promise<void> {
  mutate((data) => {
    data.aiCanBook = enabled;
  });
}

/** A lead picks a free slot: the visit is confirmed and the lead moves to "Visita marcada". */
export async function bookSlot(slotId: string, leadId: string): Promise<string> {
  return mutate((data) => {
    const slot = byId(data.slots, slotId);
    const lead = byId(data.leads, leadId);
    const appointment: Appointment = {
      id: newId('appt'),
      kind: 'visit',
      leadId,
      propertyId: lead.propertyId,
      startsAt: slot.startsAt,
      status: 'confirmed',
      title: null,
      note: null,
      bookedByAi: true,
      reminders: [
        { at: now().toISOString(), kind: 'confirmation', sent: true },
        { at: shift(slot.startsAt, -24), kind: 'day_before', sent: false },
        { at: shift(slot.startsAt, -2), kind: 'two_hours', sent: false },
        { at: shift(slot.startsAt, 1), kind: 'post_visit', sent: false },
      ],
    };
    data.appointments.push(appointment);
    lead.stage = 'visit_booked';
    lead.lastActivityAt = now().toISOString();
    data.timeline.push({
      id: newId('ev'),
      leadId,
      type: 'visit_booked',
      title: '', // rendered from the catalog by type
      detail: '',
      occurredAt: now().toISOString(),
    });
    return appointment.id;
  });
}
