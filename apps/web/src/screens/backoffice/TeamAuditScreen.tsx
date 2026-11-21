'use client';

import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
  StatusPill,
  Switch,
  useToast,
  type DataTableColumn,
} from '@casvitta/ui';
import { BackofficePageHeader, Dialog, PermissionMatrix } from '@casvitta/ui/backoffice';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';

import {
  can,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  useAudit,
  useExportAudit,
  useInviteStaff,
  useStaffMe,
  useTeam,
  useUpdateStaff,
  type AuditEntry,
  type AuditFilters,
  type StaffMember,
  type StaffRole,
} from '@/lib/data/staff';
import { StaffApiError } from '@/lib/staff-api';

import { formatDayTime, formatToday, messageKey, useAgo } from './format';
import { isReauthCancelled, useSensitive } from './ReauthProvider';

/** BO8 · Equipe e auditoria (docs/mockups/backoffice/08-team-audit). */
export function TeamAuditScreen() {
  const t = useTranslations('backoffice.team');
  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <TeamPanel />
        <MatrixPanel />
      </div>
      <AuditPanel />
    </>
  );
}

// ------------------------------------------------------------------ team

function TeamPanel() {
  const t = useTranslations('backoffice.team');
  const tStates = useTranslations('backoffice.states');
  const tRoles = useTranslations('backoffice.roles');
  const ago = useAgo();
  const me = useStaffMe().data;
  const team = useTeam();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const manage = can(me, 'staff.manage');

  const columns: DataTableColumn<StaffMember>[] = [
    {
      key: 'person',
      header: t('columns.person'),
      cell: (m) => (
        <div className="flex flex-col">
          <span className="font-semibold">{m.name}</span>
          <span className="type-caption">{m.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('columns.role'),
      cell: (m) =>
        m.active ? (
          <StatusPill tone={m.role === 'admin' ? 'info' : 'neutral'}>{tRoles(m.role)}</StatusPill>
        ) : (
          <StatusPill tone="danger">{t('inactive')}</StatusPill>
        ),
    },
    {
      key: 'seen',
      header: t('columns.lastSeen'),
      cell: (m) => (m.id === me?.id ? t('now') : ago(m.last_seen_at, t('never'))),
    },
    ...(manage
      ? [
          {
            key: 'edit',
            header: <span className="sr-only">{t('edit')}</span>,
            className: 'w-px px-2 text-right',
            cell: (m: StaffMember) =>
              m.id === me?.id ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('editLabel', { name: m.name })}
                  onClick={() => setEditing(m)}
                  className="px-2 text-action"
                >
                  {t('edit')}
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <Panel
      title={t('panel')}
      aside={
        manage ? (
          <Button size="sm" onClick={() => setInviting(true)}>
            {t('invite')}
          </Button>
        ) : null
      }
    >
      {team.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('subject') })} />
      ) : team.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('subject') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => team.refetch()}>{tStates('retry')}</Button>}
        />
      ) : (
        <DataTable caption={t('panel')} columns={columns} rows={team.data} rowKey={(m) => m.id} />
      )}
      <p className="mt-3 type-caption">{t('note')}</p>
      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
      {editing ? <EditDialog member={editing} onClose={() => setEditing(null)} /> : null}
    </Panel>
  );
}

function roleOptions(tRoles: (key: StaffRole) => string) {
  return STAFF_ROLES.map((role) => ({ value: role, label: tRoles(role) }));
}

function errorText(t: ReturnType<typeof useTranslations>, error: unknown): string {
  if (
    error instanceof StaffApiError &&
    (error.code === 'staff_exists' || error.code === 'last_admin')
  ) {
    return t(`errors.${error.code}`);
  }
  return t('errors.generic');
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('backoffice.team');
  const tRoles = useTranslations('backoffice.roles');
  const sensitive = useSensitive();
  const invite = useInviteStaff();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('read_only');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const member = await sensitive(() => invite.mutateAsync({ name, email, role }));
      toast({ title: t('invited', { name: member.name }), tone: 'success' });
      onClose();
    } catch (e) {
      if (!isReauthCancelled(e)) setError(errorText(t, e));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('inviteTitle')}
      description={t('inviteDescription')}
      closeLabel={t('cancel')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t('name')}
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t('email')}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Select
          label={t('role')}
          options={roleOptions(tRoles)}
          value={role}
          onValueChange={(v) => setRole(v as StaffRole)}
        />
        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={invite.isPending} loadingLabel={t('sending')}>
            {t('send')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const t = useTranslations('backoffice.team');
  const tRoles = useTranslations('backoffice.roles');
  const sensitive = useSensitive();
  const update = useUpdateStaff();
  const toast = useToast();
  const [role, setRole] = useState<StaffRole>(member.role);
  const [active, setActive] = useState(member.active);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await sensitive(() => update.mutateAsync({ id: member.id, role, active }));
      toast({ title: t('saved'), tone: 'success' });
      onClose();
    } catch (e) {
      if (!isReauthCancelled(e)) setError(errorText(t, e));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('editTitle', { name: member.name })}
      closeLabel={t('cancel')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Select
          label={t('role')}
          options={roleOptions(tRoles)}
          value={role}
          onValueChange={(v) => setRole(v as StaffRole)}
        />
        <Switch
          label={t('active')}
          description={t('activeHelp')}
          checked={active}
          onCheckedChange={setActive}
        />
        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={update.isPending} loadingLabel={t('saving')}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------------ permissions

function MatrixPanel() {
  const t = useTranslations('backoffice.permissions');
  const tRoles = useTranslations('backoffice.roles');
  return (
    <Panel title={t('title')}>
      <PermissionMatrix
        caption={t('title')}
        permissionHeader={t('header')}
        yesLabel={t('yes')}
        noLabel={t('no')}
        roles={STAFF_ROLES.map((role) => ({ key: role, label: tRoles(role) }))}
        rows={PERMISSIONS.map((permission) => ({
          key: permission,
          label: t(`rows.${messageKey(permission)}`),
          allowed: Object.fromEntries(
            STAFF_ROLES.map((role) => [role, ROLE_PERMISSIONS[role].includes(permission)]),
          ),
        }))}
      />
    </Panel>
  );
}

// ------------------------------------------------------------------ audit

/** "Ana Ribeiro · CRECI-SP 000.000-F" style line from the entry's details, plus the reason. */
export function auditDetail(
  entry: AuditEntry,
  labels: { reason: (reason: string) => string; value: (key: string, value: string) => string },
): string {
  const parts: string[] = [];
  const add = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '' || key.endsWith('_id')) return;
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) add(k, v);
      return;
    }
    parts.push(labels.value(key, String(value)));
  };
  for (const [key, value] of Object.entries(entry.details)) add(key, value);
  if (entry.reason) parts.push(labels.reason(entry.reason));
  return parts.join(' · ');
}

function isRole(value: string): value is StaffRole {
  return (STAFF_ROLES as string[]).includes(value);
}

function AuditPanel() {
  const t = useTranslations('backoffice.audit');
  const tRoles = useTranslations('backoffice.roles');
  const tStates = useTranslations('backoffice.states');
  const me = useStaffMe().data;
  const team = useTeam().data ?? [];
  const sensitive = useSensitive();
  const toast = useToast();
  const [filters, setFilters] = useState<AuditFilters>({});
  const exporter = useExportAudit();
  const allowed = can(me, 'audit.view');
  const audit = useAudit(filters, allowed);
  const entries = useMemo(() => audit.data?.pages.flatMap((p) => p.items) ?? [], [audit.data]);
  const actions = audit.data?.pages[0]?.actions ?? [];

  const personValue = filters.staffId ?? filters.actor ?? '';
  const personOptions = [
    { value: 'all', label: t('filters.everyone') },
    ...team.map((m) => ({ value: m.id, label: m.name })),
    { value: 'system', label: t('filters.system') },
    { value: 'system:admin-token', label: t('filters.script') },
  ];

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: 'when',
      header: t('columns.when'),
      cell: (e) => <span className="font-mono tabular">{formatDayTime(e.occurred_at)}</span>,
      className: 'whitespace-nowrap',
    },
    { key: 'who', header: t('columns.who'), cell: (e) => e.actor_name },
    {
      key: 'action',
      header: t('columns.action'),
      cell: (e) => <span className="font-mono text-[13px]">{e.action}</span>,
    },
    {
      key: 'detail',
      header: t('columns.detail'),
      cell: (e) =>
        auditDetail(e, {
          reason: (reason) => t('reason', { reason }),
          value: (key, value) =>
            (key === 'role' || key === 'previous_role') && isRole(value) ? tRoles(value) : value,
        }),
    },
  ];

  if (!allowed) {
    return (
      <Panel title={t('title')} className="mt-5">
        <p className="type-body text-fg-muted">{tStates('forbidden')}</p>
      </Panel>
    );
  }

  const runExport = async () => {
    try {
      await sensitive(() => exporter.mutateAsync(filters));
      toast({ title: t('exported'), tone: 'success' });
    } catch {
      // cancelled or failed: nothing was downloaded
    }
  };

  return (
    <Panel
      title={t('title')}
      className="mt-5"
      aside={
        can(me, 'audit.export') ? (
          <Button
            size="sm"
            variant="secondary"
            loading={exporter.isPending}
            loadingLabel={t('exporting')}
            onClick={runExport}
          >
            {t('export')}
          </Button>
        ) : null
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Select
          label={t('filters.person')}
          options={personOptions}
          value={personValue || 'all'}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              staffId: v === 'all' || v.startsWith('system') ? undefined : v,
              actor: v === 'system' || v === 'system:admin-token' ? v : undefined,
            }))
          }
        />
        <Select
          label={t('filters.action')}
          options={[
            { value: 'all', label: t('filters.all') },
            ...actions.map((a) => ({ value: a, label: a })),
          ]}
          value={filters.action ?? 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, action: v === 'all' ? undefined : v }))}
        />
        <Input
          label={t('filters.since')}
          type="date"
          value={filters.since ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value || undefined }))}
        />
        <Input
          label={t('filters.until')}
          type="date"
          value={filters.until ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, until: e.target.value || undefined }))}
        />
      </div>
      {audit.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('subject') })} />
      ) : audit.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('subject') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => audit.refetch()}>{tStates('retry')}</Button>}
        />
      ) : (
        <DataTable
          caption={t('title')}
          columns={columns}
          rows={entries}
          rowKey={(e) => e.id}
          empty={<EmptyState title={t('empty')} />}
        />
      )}
      {audit.hasNextPage ? (
        <Button
          variant="ghost"
          className="mt-3"
          loading={audit.isFetchingNextPage}
          loadingLabel={t('loadingMore')}
          onClick={() => audit.fetchNextPage()}
        >
          {t('more')}
        </Button>
      ) : null}
      <p className="mt-3 type-caption">{t('note')}</p>
    </Panel>
  );
}
