/**
 * Casvitta Social (SOC-1a): the broker's page on {slug}.casvitta.com.br. Live API only ("social"
 * area). The page reads the broker profile and the properties published on the "bio_page" channel.
 */
import type { components } from '@casvitta/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, API_INTERNAL_URL } from '@/lib/api';

import { CrmError } from './crm';

type S = components['schemas'];
export type Page = S['PageOut'];
export type PageUpdate = S['PageUpdate'];
export type PageTheme = S['PageTheme'];
export type PageStats = S['PageStatsOut'];
export type PublicPage = S['PublicPageOut'];
export type PageEventKind = S['PageEventKind'];
export type PageSource = S['PageSource'];
export type PageInquiry = S['PageInquiryIn'];
export type PropertyKind = S['app__domains__properties__models__PropertyKind'];

export const PAGE_THEMES: PageTheme[] = ['cambui', 'planta', 'terracota'];

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

const KEY = ['page'] as const;
const asForm = (body: unknown) => body as FormData;

export function usePage(enabled = true) {
  return useQuery({
    queryKey: KEY,
    enabled,
    queryFn: async () => check(await api.GET('/v1/page')),
  });
}

export function usePageStats(days = 30) {
  return useQuery({
    queryKey: [...KEY, 'stats', days],
    queryFn: async () => check(await api.GET('/v1/page/stats', { params: { query: { days } } })),
  });
}

function usePageMutation<A>(fn: (arg: A) => Promise<Page>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (page) => client.setQueryData(KEY, page),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePage() {
  return usePageMutation(async (body: PageUpdate) => check(await api.PATCH('/v1/page', { body })));
}

export function usePublishPage() {
  return usePageMutation(async (publish: boolean) =>
    check(publish ? await api.POST('/v1/page/publish') : await api.POST('/v1/page/unpublish')),
  );
}

export function useUploadPagePhoto() {
  return usePageMutation(async (file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return check(
      await api.POST('/v1/page/photo', { body: asForm(form) as never, bodySerializer: asForm }),
    );
  });
}

/** Same-origin download links (the session cookie goes along). */
export const qrHref = (kind: 'png' | 'pdf') => `/api/v1/page/qr.${kind}`;

/** Server-side read of a public page; null when it is not live. */
export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  const response = await fetch(`${API_INTERNAL_URL}/v1/public/pages/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`page API ${response.status}`);
  return (await response.json()) as PublicPage;
}

/** "?origem=qr" from the printed QR; utm_* = campaign; otherwise the bio link. */
export function sourceFromSearch(search: URLSearchParams): PageSource {
  if (search.get('origem') === 'qr') return 'qr';
  if ([...search.keys()].some((k) => k.startsWith('utm_'))) return 'campaign';
  return 'link';
}

/** Counts a view or a WhatsApp click (fire and forget; never blocks the visitor). */
export function sendPageEvent(
  slug: string,
  kind: PageEventKind,
  source: PageSource,
  propertyCode?: string,
): void {
  const body = JSON.stringify({
    kind,
    source,
    ...(propertyCode ? { property_code: propertyCode } : {}),
  });
  void fetch(`/api/v1/public/pages/${encodeURIComponent(slug)}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/** wa.me link with a prefilled message. */
export function whatsappHref(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export type PlanUsage = S['PlanUsageOut'];

/** Current plan, meters and the open plan request (Plano e uso). */
export function usePlanUsage() {
  return useQuery({
    queryKey: [...KEY, 'plan'],
    queryFn: async () => check(await api.GET('/v1/me/plan')),
  });
}

/** Finder "Pedir ajuda" or the owner form: goes to the broker's Interessados (CRM). */
export async function submitPageInquiry(slug: string, body: PageInquiry): Promise<void> {
  check(await api.POST('/v1/public/pages/{slug}/inquiries', { params: { path: { slug } }, body }));
}
