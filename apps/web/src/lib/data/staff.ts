'use client';

/**
 * Backoffice data (admin host). TanStack Query over the staff API. Every write invalidates the
 * backoffice queries so counts, queues and the audit log stay in step.
 */
import type { components } from '@casvitta/api-client';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { downloadCsv, staffApi, unwrap } from '@/lib/staff-api';

export type StaffMe = components['schemas']['StaffMeOut'];
export type StaffMember = components['schemas']['StaffMemberOut'];
export type StaffRole = components['schemas']['StaffRole'];
export type Permission = components['schemas']['Permission'];
export type AuditEntry = components['schemas']['AuditEntryOut'];
export type Overview = components['schemas']['OverviewOut'];
export type SearchHit = components['schemas']['SearchHit'];
export type InterestKind = components['schemas']['InterestKind'];

export const STAFF_ROLES: StaffRole[] = [
  'admin',
  'operations',
  'commercial',
  'finance',
  'read_only',
];
export const PERMISSIONS: Permission[] = [
  'creci.verify',
  'captures.handle',
  'contacts.export',
  'listings.moderate',
  'contacts.reveal',
  'accounts.view_as',
  'billing.manage',
  'staff.manage',
  'audit.view',
  'audit.export',
];

/** Mirrors apps/api/app/domains/staff/permissions.py for the matrix on screen (BO8). The API
 * enforces the real thing; this table only draws it. */
export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  admin: PERMISSIONS,
  operations: [
    'creci.verify',
    'captures.handle',
    'contacts.export',
    'listings.moderate',
    'contacts.reveal',
    'accounts.view_as',
    'audit.view',
  ],
  commercial: ['captures.handle', 'contacts.export', 'contacts.reveal', 'audit.view'],
  finance: ['contacts.reveal', 'accounts.view_as', 'billing.manage', 'audit.view'],
  read_only: [],
};

const ROOT = 'staff';
export const staffKeys = {
  me: [ROOT, 'me'] as const,
  overview: [ROOT, 'overview'] as const,
  search: (q: string) => [ROOT, 'search', q] as const,
  team: [ROOT, 'team'] as const,
  audit: (filters: AuditFilters) => [ROOT, 'audit', filters] as const,
};

function invalidateAll(client: QueryClient) {
  return client.invalidateQueries({ queryKey: [ROOT] });
}

// ------------------------------------------------------------------ session

export function useStaffMe() {
  return useQuery({
    queryKey: staffKeys.me,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/me')),
    staleTime: 60_000,
  });
}

export function can(me: StaffMe | undefined, permission: Permission): boolean {
  return me?.permissions.includes(permission) ?? false;
}

export async function requestStaffLink(email: string): Promise<void> {
  unwrap(await staffApi.POST('/v1/staff/auth/email-link', { body: { email } }));
}

export async function confirmStaffLink(token: string): Promise<void> {
  const result = await staffApi.POST('/v1/staff/auth/confirm', { body: { token } });
  if (!result.response.ok) unwrap(result);
}

export async function signOutStaff(): Promise<void> {
  await staffApi.POST('/v1/staff/auth/sign-out');
}

export async function requestReauthCode(): Promise<void> {
  unwrap(await staffApi.POST('/v1/staff/auth/reauth/request'));
}

export function useConfirmReauth() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      unwrap(await staffApi.POST('/v1/staff/auth/reauth/confirm', { body: { code } })),
    onSuccess: (me) => client.setQueryData(staffKeys.me, me),
  });
}

// ------------------------------------------------------------------ team

export function useTeam() {
  return useQuery({
    queryKey: staffKeys.team,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/team')),
  });
}

export function useInviteStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: components['schemas']['StaffInviteIn']) =>
      unwrap(await staffApi.POST('/v1/staff/team', { body })),
    onSuccess: () => invalidateAll(client),
  });
}

export function useUpdateStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & components['schemas']['StaffUpdateIn']) =>
      unwrap(
        await staffApi.PATCH('/v1/staff/team/{staff_id}', {
          params: { path: { staff_id: id } },
          body,
        }),
      ),
    onSuccess: () => invalidateAll(client),
  });
}

// ------------------------------------------------------------------ audit

export type AuditFilters = {
  staffId?: string;
  actor?: 'system' | 'system:admin-token';
  action?: string;
  since?: string; // yyyy-MM-dd (São Paulo)
  until?: string; // yyyy-MM-dd, inclusive
};

/** São Paulo day bounds as ISO instants ("2026-11-20" → 2026-11-20T00:00-03:00). */
function dayStart(day: string): string {
  return `${day}T00:00:00-03:00`;
}
function dayAfter(day: string): string {
  const next = new Date(`${day}T12:00:00-03:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  return dayStart(next.toISOString().slice(0, 10));
}

function auditQuery(filters: AuditFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.staffId) query.staff_id = filters.staffId;
  if (filters.actor) query.actor = filters.actor;
  if (filters.action) query.action = filters.action;
  if (filters.since) query.since = dayStart(filters.since);
  if (filters.until) query.until = dayAfter(filters.until);
  return query;
}

export function useAudit(filters: AuditFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: staffKeys.audit(filters),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await staffApi.GET('/v1/staff/audit', {
          params: {
            query: {
              ...auditQuery(filters),
              ...(pageParam ? { before: pageParam } : {}),
              limit: 50,
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_before ?? undefined,
  });
}

/** Downloads the CSV; the export itself is audited, so the log refreshes afterwards. */
export function useExportAudit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (filters: AuditFilters) =>
      downloadCsv('/v1/staff/audit/export', auditQuery(filters)),
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------------------------ overview and search

export function useOverview() {
  return useQuery({
    queryKey: staffKeys.overview,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/overview')),
    refetchInterval: 60_000,
  });
}

/** Global search. Each search is audited server-side, so it runs only for 2+ characters. */
export function useStaffSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: staffKeys.search(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
    queryFn: async () =>
      unwrap(await staffApi.GET('/v1/staff/search', { params: { query: { q: query } } })),
  });
}
