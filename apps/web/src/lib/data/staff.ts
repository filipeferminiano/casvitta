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

import { downloadCsv, StaffApiError, staffApi, unwrap } from '@/lib/staff-api';

export type StaffMe = components['schemas']['StaffMeOut'];
export type StaffMember = components['schemas']['StaffMemberOut'];
export type StaffRole = components['schemas']['StaffRole'];
export type Permission = components['schemas']['Permission'];
export type AuditEntry = components['schemas']['AuditEntryOut'];
export type Overview = components['schemas']['OverviewOut'];
export type SearchHit = components['schemas']['SearchHit'];
export type InterestKind = components['schemas']['InterestKind'];
export type CreciItem = components['schemas']['CreciItem'];
export type CreciTab = 'pending' | 'correction_requested' | 'verified' | 'rejected';
export type CreciChecklist = components['schemas']['CreciChecklist'];
export type CaptureItem = components['schemas']['CaptureItem'];
export type BrokerCandidate = components['schemas']['BrokerCandidate'];
export type AlertGroup = components['schemas']['AlertGroup'];
export type AccountRow = components['schemas']['AccountRow'];
export type Account360 = components['schemas']['Account360'];
export type AccountView = 'all' | 'agencies' | 'creci_pending' | 'no_access' | 'paused';
export type CaptureState = 'no_broker' | 'referred' | 'accepted' | 'open' | 'handled';
export type CaptureFilters = {
  kind: InterestKind;
  state?: CaptureState;
  optIn?: 'confirmed' | 'pending';
  region?: string;
  origin?: string;
};

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
  creci: (tab: CreciTab) => [ROOT, 'creci', tab] as const,
  captures: (f: CaptureFilters) => [ROOT, 'captures', f] as const,
  capture: (id: string) => [ROOT, 'capture', id] as const,
  candidates: (id: string) => [ROOT, 'candidates', id] as const,
  alertGroups: [ROOT, 'alert-groups'] as const,
  accounts: (view: AccountView) => [ROOT, 'accounts', view] as const,
  account: (id: string) => [ROOT, 'account', id] as const,
  moderation: [ROOT, 'moderation'] as const,
  revenue: [ROOT, 'revenue'] as const,
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

// ------------------------------------------------------------------ CRECI (BO2)

export function useCreciQueue(tab: CreciTab) {
  return useQuery({
    queryKey: staffKeys.creci(tab),
    queryFn: async () =>
      unwrap(await staffApi.GET('/v1/staff/creci', { params: { query: { status: tab } } })),
  });
}

type CreciDecision =
  | { id: string; outcome: 'approve'; checklist: CreciChecklist }
  | { id: string; outcome: 'request-correction' | 'reject'; reason: string };

export function useDecideCreci() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (d: CreciDecision) => {
      const path = { params: { path: { profile_id: d.id } } };
      if (d.outcome === 'approve') {
        return unwrap(
          await staffApi.POST('/v1/staff/creci/{profile_id}/approve', {
            ...path,
            body: { checklist: d.checklist },
          }),
        );
      }
      const body = { reason: d.reason };
      return unwrap(
        d.outcome === 'reject'
          ? await staffApi.POST('/v1/staff/creci/{profile_id}/reject', { ...path, body })
          : await staffApi.POST('/v1/staff/creci/{profile_id}/request-correction', {
              ...path,
              body,
            }),
      );
    },
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------------------------ captures (BO3)

function captureQuery(f: CaptureFilters) {
  return {
    kind: f.kind,
    ...(f.state ? { state: f.state } : {}),
    ...(f.optIn ? { opt_in: f.optIn } : {}),
    ...(f.region ? { region: f.region } : {}),
    ...(f.origin ? { origin: f.origin } : {}),
  };
}

export function useCaptures(filters: CaptureFilters) {
  return useQuery({
    queryKey: staffKeys.captures(filters),
    queryFn: async () =>
      unwrap(
        await staffApi.GET('/v1/staff/captures', { params: { query: captureQuery(filters) } }),
      ),
  });
}

/** Opening a request is audited server-side (a read of personal data). */
export function useCapture(id: string | null) {
  return useQuery({
    queryKey: staffKeys.capture(id ?? ''),
    enabled: id !== null,
    queryFn: async () =>
      unwrap(
        await staffApi.GET('/v1/staff/captures/{signup_id}', {
          params: { path: { signup_id: id ?? '' } },
        }),
      ),
  });
}

export function useCandidates(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: staffKeys.candidates(id ?? ''),
    enabled: enabled && id !== null,
    queryFn: async () =>
      unwrap(
        await staffApi.GET('/v1/staff/captures/{signup_id}/candidates', {
          params: { path: { signup_id: id ?? '' } },
        }),
      ),
  });
}

export async function revealContact(id: string, field: 'phone' | 'email', reason: string) {
  return unwrap(
    await staffApi.POST('/v1/staff/captures/{signup_id}/reveal', {
      params: { path: { signup_id: id } },
      body: { field, reason },
    }),
  );
}

export function useAssignCapture() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, brokerId }: { id: string; brokerId: string }) =>
      unwrap(
        await staffApi.POST('/v1/staff/captures/{signup_id}/assign', {
          params: { path: { signup_id: id } },
          body: { broker_profile_id: brokerId },
        }),
      ),
    onSettled: () => invalidateAll(client),
  });
}

export function useMarkHandled() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, handled }: { id: string; handled: boolean }) =>
      unwrap(
        await staffApi.POST('/v1/staff/captures/{signup_id}/handled', {
          params: { path: { signup_id: id } },
          body: { handled },
        }),
      ),
    onSettled: () => invalidateAll(client),
  });
}

/** Only opted-in contacts; needs the export permission and is audited. */
export function useExportCaptures() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (f: CaptureFilters) => {
      const q: Record<string, string> = { kind: f.kind };
      if (f.region) q.region = f.region;
      if (f.origin) q.origin = f.origin;
      return downloadCsv('/v1/staff/captures/export', q);
    },
    onSettled: () => invalidateAll(client),
  });
}

export function useAlertGroups(enabled: boolean) {
  return useQuery({
    queryKey: staffKeys.alertGroups,
    enabled,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/property-alerts/groups')),
  });
}

// ------------------------------------------------------------------ accounts (BO4, BO5)

export function useAccounts(view: AccountView) {
  return useQuery({
    queryKey: staffKeys.accounts(view),
    queryFn: async () =>
      unwrap(await staffApi.GET('/v1/staff/accounts', { params: { query: { view } } })),
  });
}

/** Opening an account is audited server-side. */
export function useAccount(id: string) {
  return useQuery({
    queryKey: staffKeys.account(id),
    queryFn: async () =>
      unwrap(
        await staffApi.GET('/v1/staff/accounts/{workspace_id}', {
          params: { path: { workspace_id: id } },
        }),
      ),
  });
}

export function useAccountAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'pause' | 'resume';
      reason: string;
    }) => {
      const params = { path: { workspace_id: id } };
      const result =
        action === 'pause'
          ? await staffApi.POST('/v1/staff/accounts/{workspace_id}/pause-publishing', {
              params,
              body: { reason },
            })
          : await staffApi.POST('/v1/staff/accounts/{workspace_id}/resume-publishing', {
              params,
              body: { reason },
            });
      if (!result.response.ok) unwrap(result);
    },
    onSettled: () => invalidateAll(client),
  });
}

export async function viewAsCustomer(id: string, reason: string): Promise<string> {
  const out = unwrap(
    await staffApi.POST('/v1/staff/accounts/{workspace_id}/view-as', {
      params: { path: { workspace_id: id } },
      body: { reason },
    }),
  );
  return out.url;
}

export function useAddNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) =>
      unwrap(
        await staffApi.POST('/v1/staff/accounts/{workspace_id}/notes', {
          params: { path: { workspace_id: id } },
          body: { body },
        }),
      ),
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------------------------ moderation (BO6), revenue (BO7)

export type ModerationQueue = components['schemas']['ModerationQueueOut'];
export type RevenueLine = components['schemas']['RevenueLine'];

export function useModeration() {
  return useQuery({
    queryKey: staffKeys.moderation,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/moderation')),
  });
}

export function useRevenue(enabled: boolean) {
  return useQuery({
    queryKey: staffKeys.revenue,
    enabled,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/revenue')),
  });
}

// ------------------------------------------------------------------ plan requests (CRM-0)

export type PlanRequest = components['schemas']['StaffChangeRequestOut'];

export function usePlanRequests(enabled: boolean) {
  return useQuery({
    queryKey: ['staff', 'plan-requests'],
    enabled,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/plan-requests')),
  });
}

export type PlanDecision =
  { id: string; outcome: 'approve' } | { id: string; outcome: 'decline'; reason: string };

/** Approve assigns the plan (or add-on) by hand while billing is off; both are audited. */
export function useDecidePlanRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (d: PlanDecision) => {
      const path = { params: { path: { request_id: d.id } } };
      const result =
        d.outcome === 'approve'
          ? await staffApi.POST('/v1/staff/plan-requests/{request_id}/approve', path)
          : await staffApi.POST('/v1/staff/plan-requests/{request_id}/decline', {
              ...path,
              body: { reason: d.reason },
            });
      if (result.error !== undefined) unwrap(result);
    },
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------------------------ owner authorizations (BO6)

export type AuthorizationItem = components['schemas']['AuthorizationItem'];

export function useAuthorizationQueue(enabled: boolean) {
  return useQuery({
    queryKey: ['staff', 'authorizations'],
    enabled,
    queryFn: async () => unwrap(await staffApi.GET('/v1/staff/authorizations')),
  });
}

export type AuthorizationDecision =
  { id: string; outcome: 'verify' } | { id: string; outcome: 'reject'; reason: string };

/** Verify puts the waiting listings live; reject keeps them off with the reason. Audited. */
export function useDecideAuthorization() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (d: AuthorizationDecision) => {
      const path = { params: { path: { authorization_id: d.id } } };
      const result =
        d.outcome === 'verify'
          ? await staffApi.POST('/v1/staff/authorizations/{authorization_id}/verify', path)
          : await staffApi.POST('/v1/staff/authorizations/{authorization_id}/reject', {
              ...path,
              body: { reason: d.reason },
            });
      if (result.error !== undefined) unwrap(result);
    },
    onSettled: () => invalidateAll(client),
  });
}

/** Opens the stored document in a new tab (the view is audited by the API). */
export async function openAuthorizationDocument(id: string): Promise<void> {
  const response = await fetch(`/api/v1/staff/authorizations/${id}/document`, {
    credentials: 'include',
  });
  if (!response.ok) throw new StaffApiError('document', '', response.status);
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener');
}
