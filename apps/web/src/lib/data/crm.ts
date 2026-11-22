/**
 * CRM data (CRM-1): Início, Contatos, Funil, Caixa de entrada, Agenda. Live API only ("crm" area):
 * these screens never fall back to demo fixtures. Every mutation invalidates the CRM queries so
 * the same contact shows the same state in every screen.
 */
import type { components } from '@casvitta/api-client';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

type S = components['schemas'];
export type HomeData = S['HomeOut'];
export type ContactList = S['ContactListOut'];
export type ContactRow = S['ContactRow'];
export type ContactView = 'all' | 'buyers' | 'tenants' | 'owners' | 'no_reply_14d';
export type Contact360 = S['Contact360'];
export type ContactIn = S['ContactIn'];
export type ConsentIn = S['ContactConsentIn'];
export type BoardColumn = S['BoardColumn'];
export type BoardCard = S['BoardCard'];
export type StageOut = S['StageOut'];
export type InboxItem = S['InboxItem'];
export type Thread = S['ThreadOut'];
export type WeekData = S['WeekOut'];
export type CalendarSettings = S['SettingsOut'];
export type Slot = S['Slot'];
export type Visit = S['VisitOut'];

/** API error with the pt-BR message from the server. */
export class CrmError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

function check<T>(result: Result<T>): T {
  if (result.error !== undefined || !result.response.ok) {
    const body = result.error as { error?: { code?: string; message?: string } } | undefined;
    throw new CrmError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? '',
      result.response.status,
    );
  }
  return result.data as T;
}

const KEY = ['crm'] as const;
const invalidate = (client: QueryClient) => client.invalidateQueries({ queryKey: KEY });

export function useHome() {
  return useQuery({ queryKey: [...KEY, 'home'], queryFn: async () => check(await api.GET('/v1/home')) });
}

export function useContacts(view: ContactView, q: string) {
  return useQuery({
    queryKey: [...KEY, 'contacts', view, q],
    queryFn: async () =>
      check(
        await api.GET('/v1/contacts', { params: { query: { view, ...(q ? { q } : {}) } } }),
      ),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: [...KEY, 'contact', id],
    queryFn: async () =>
      check(await api.GET('/v1/contacts/{person_id}', { params: { path: { person_id: id } } })),
  });
}

export function useCreateContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: ContactIn) => check(await api.POST('/v1/contacts', { body })),
    onSettled: () => invalidate(client),
  });
}

export function useAddNote(personId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      check(
        await api.POST('/v1/contacts/{person_id}/notes', {
          params: { path: { person_id: personId } },
          body: { body },
        }),
      ),
    onSettled: () => invalidate(client),
  });
}

export function useAddTask(personId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; due_at?: string | null }) =>
      check(
        await api.POST('/v1/contacts/{person_id}/tasks', {
          params: { path: { person_id: personId } },
          body,
        }),
      ),
    onSettled: () => invalidate(client),
  });
}

export function useSetConsent(personId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: ConsentIn) =>
      check(
        await api.POST('/v1/contacts/{person_id}/consents', {
          params: { path: { person_id: personId } },
          body,
        }),
      ),
    onSettled: () => invalidate(client),
  });
}

export function usePipeline() {
  return useQuery({
    queryKey: [...KEY, 'pipeline'],
    queryFn: async () => check(await api.GET('/v1/pipeline')),
  });
}

export function useMoveLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      check(
        await api.POST('/v1/leads/{lead_id}/move', {
          params: { path: { lead_id: leadId } },
          body: { stage_id: stageId },
        }),
      ),
    // Optimistic: the card moves at once; a failure puts it back on refetch.
    onMutate: async ({ leadId, stageId }) => {
      await client.cancelQueries({ queryKey: [...KEY, 'pipeline'] });
      const previous = client.getQueryData<BoardColumn[]>([...KEY, 'pipeline']);
      if (previous) {
        const card = previous.flatMap((c) => c.cards).find((c) => c.lead_id === leadId);
        if (card) {
          client.setQueryData<BoardColumn[]>(
            [...KEY, 'pipeline'],
            previous.map((c) => ({
              ...c,
              cards:
                c.stage.id === stageId
                  ? [card, ...c.cards.filter((x) => x.lead_id !== leadId)]
                  : c.cards.filter((x) => x.lead_id !== leadId),
            })),
          );
        }
      }
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) client.setQueryData([...KEY, 'pipeline'], context.previous);
    },
    onSettled: () => invalidate(client),
  });
}

export function useInbox(needsYou: boolean) {
  return useQuery({
    queryKey: [...KEY, 'inbox', needsYou],
    queryFn: async () =>
      check(await api.GET('/v1/conversations', { params: { query: { needs_you: needsYou } } })),
    refetchInterval: 20_000,
  });
}

export function useThread(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'thread', id],
    enabled: Boolean(id),
    queryFn: async () =>
      check(
        await api.GET('/v1/conversations/{conversation_id}', {
          params: { path: { conversation_id: id! } },
        }),
      ),
    refetchInterval: 10_000,
  });
}

export function useReply(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      check(
        await api.POST('/v1/conversations/{conversation_id}/messages', {
          params: { path: { conversation_id: conversationId } },
          body: { body, idempotency_key: crypto.randomUUID() },
        }),
      ),
    onSettled: () => invalidate(client),
  });
}

export function useTakeOver(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      check(
        await api.POST('/v1/conversations/{conversation_id}/take-over', {
          params: { path: { conversation_id: conversationId } },
        }),
      ),
    onSettled: () => invalidate(client),
  });
}

export function useWeek(start: string) {
  return useQuery({
    queryKey: [...KEY, 'week', start],
    queryFn: async () => check(await api.GET('/v1/calendar/week', { params: { query: { start } } })),
  });
}

export function useCalendarSettings() {
  return useQuery({
    queryKey: [...KEY, 'calendar-settings'],
    queryFn: async () => check(await api.GET('/v1/calendar/settings')),
  });
}

export function useSaveCalendarSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: CalendarSettings) =>
      check(await api.PUT('/v1/calendar/settings', { body })),
    onSettled: () => invalidate(client),
  });
}

export function useSlots(propertyId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'slots', propertyId],
    queryFn: async () =>
      check(
        await api.GET('/v1/calendar/slots', {
          params: { query: propertyId ? { property_id: propertyId } : {} },
        }),
      ),
  });
}

export function useBookVisit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { person_id: string; property_id?: string | null; starts_at: string }) =>
      check(await api.POST('/v1/calendar/visits', { body: { ...body, booked_by: 'broker' } })),
    onSettled: () => invalidate(client),
  });
}

export function useBlockTime() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { starts_at: string; ends_at: string }) =>
      check(await api.POST('/v1/calendar/blocks', { body })),
    onSettled: () => invalidate(client),
  });
}
