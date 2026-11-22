'use client';

import {
  BackofficeShell,
  EnvironmentBadge,
  type BackofficeNavGroup,
  type BackofficeNavItem,
} from '@casvitta/ui/backoffice';
import {
  ClipboardList,
  FileText,
  House,
  LayoutGrid,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { signOutStaff, useOverview, useStaffMe } from '@/lib/data/staff';

import { GlobalSearch } from './GlobalSearch';

import { ReauthProvider } from './ReauthProvider';

/** Visible paths on admin.casvitta.com.br (the proxy serves them from /bo/*). */
export const BO_PATHS = {
  overview: '/',
  creci: '/creci',
  captures: '/captacoes',
  authorizations: '/autorizacoes',
  moderation: '/moderacao',
  accounts: '/contas',
  revenue: '/receita',
  team: '/equipe',
} as const;

export type BoModule = keyof typeof BO_PATHS;

const ICONS: Record<BoModule, BackofficeNavItem['icon']> = {
  overview: House,
  creci: FileText,
  captures: Users,
  authorizations: ShieldCheck,
  moderation: ClipboardList,
  accounts: LayoutGrid,
  revenue: Receipt,
  team: Settings,
};

const SEGMENT: Record<string, BoModule> = {
  creci: 'creci',
  captacoes: 'captures',
  autorizacoes: 'authorizations',
  moderacao: 'moderation',
  contas: 'accounts',
  receita: 'revenue',
  equipe: 'team',
};

export type QueueCounts = Partial<Record<BoModule, number>>;

export function StaffShell({ children }: { children: ReactNode }) {
  const t = useTranslations('backoffice.shell');
  const tRoles = useTranslations('backoffice.roles');
  const segment = useSelectedLayoutSegment();
  const active: BoModule = segment ? (SEGMENT[segment] ?? 'overview') : 'overview';
  const me = useStaffMe().data;
  const overview = useOverview().data;
  const counts: QueueCounts = {
    creci: overview?.tiles.creci_pending,
    captures: overview?.queue.find((q) => q.key === 'owner_requests')?.count,
  };
  const [leaving, setLeaving] = useState(false);

  const item = (key: BoModule): BackofficeNavItem => ({
    key,
    href: BO_PATHS[key],
    label: t(`items.${key}`),
    icon: ICONS[key],
    current: active === key,
    count: counts?.[key],
    countTone: 'attention',
    countLabel: counts?.[key] ? t('countLabel', { count: counts[key] }) : undefined,
  });

  const groups: BackofficeNavGroup[] = [
    { key: 'home', items: [item('overview')] },
    {
      key: 'operation',
      label: t('groups.operation'),
      items: [item('creci'), item('captures'), item('authorizations'), item('moderation')],
    },
    { key: 'clients', label: t('groups.clients'), items: [item('accounts'), item('revenue')] },
    { key: 'system', label: t('groups.system'), items: [item('team')] },
  ];

  return (
    <ReauthProvider>
      <BackofficeShell
        brand={t('brand')}
        badge={t('badge')}
        homeHref={BO_PATHS.overview}
        homeLabel={t('home')}
        navLabel={t('nav')}
        skipLabel={t('skip')}
        linkAs={Link}
        groups={groups}
        search={<GlobalSearch />}
        badges={
          me ? (
            <EnvironmentBadge
              environment={me.environment}
              label={t(`environment.${me.environment}`)}
            />
          ) : null
        }
        footer={
          me ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-white">
                {t('who', { name: me.name.split(' ')[0] ?? me.name, role: tRoles(me.role) })}
              </span>
              <span>{t('footerNote')}</span>
              <button
                type="button"
                className="mt-2 inline-flex min-h-11 items-center gap-2 self-start rounded-control text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
                disabled={leaving}
                onClick={async () => {
                  setLeaving(true);
                  await signOutStaff();
                  // Full reload on purpose: drops every cached query of the session.
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.assign('/entrar');
                }}
              >
                {leaving ? t('signingOut') : t('signOut')}
              </button>
            </div>
          ) : null
        }
      >
        {children}
      </BackofficeShell>
    </ReauthProvider>
  );
}
