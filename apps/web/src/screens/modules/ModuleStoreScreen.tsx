'use client';

import { Button, ModuleCard, StatusPill, useToast } from '@casvitta/ui';
import {
  Building2,
  CalendarDays,
  FileText,
  House,
  LayoutGrid,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import type { ModuleItem } from '@/domain/types';
import { actions, useAction, useModules } from '@/lib/data/hooks';
import type { ModuleView } from '@/lib/data/modules';

const ICONS: Record<ModuleItem['icon'], React.ReactNode> = {
  users: <Users strokeWidth={1.6} />,
  sparkles: <Sparkles strokeWidth={1.6} />,
  megaphone: <Megaphone strokeWidth={1.6} />,
  file: <FileText strokeWidth={1.6} />,
  building: <Building2 strokeWidth={1.6} />,
  calendar: <CalendarDays strokeWidth={1.6} />,
  shield: <ShieldCheck strokeWidth={1.6} />,
  home: <House strokeWidth={1.6} />,
};

/** Mockup 04 (store part): Ativo / Disponível / Em breve. "Em breve" only records interest. */
export function ModuleStoreScreen() {
  const t = useTranslations('store');
  const query = useModules();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t.rich('subtitle', { strong: (c) => <strong>{c}</strong> })}
        demo
      />
      <ScreenStates
        query={query}
        subject={t('subject')}
        isEmpty={(m) => m.length === 0}
        empty={{
          icon: <LayoutGrid strokeWidth={1.6} />,
          title: t('emptyTitle'),
          description: t('emptyDescription'),
        }}
      >
        {(modules) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map((m) => (
              <StoreCard key={m.key} module={m} />
            ))}
          </div>
        )}
      </ScreenStates>
    </div>
  );
}

function StoreCard({ module: m }: { module: ModuleView }) {
  const t = useTranslations('store');
  const toast = useToast();
  const interest = useAction(actions.registerInterest);
  const activate = useAction(actions.activateModule);

  const pill =
    m.state === 'active' ? (
      <StatusPill tone="success">{t('states.active')}</StatusPill>
    ) : m.state === 'available' ? (
      <StatusPill tone="info">{t('states.available')}</StatusPill>
    ) : (
      <StatusPill tone="neutral">{t('states.soon')}</StatusPill>
    );

  const action =
    m.state === 'active' ? (
      <Button asChild variant="secondary">
        <Link href={m.key === 'ai_agent' ? '/conversas' : '/configuracoes'}>
          {m.key === 'ai_agent' ? t('adjustRules') : t('manage')}
        </Link>
      </Button>
    ) : m.state === 'available' ? (
      <Button
        loading={activate.isPending}
        loadingLabel={t('activating')}
        onClick={() =>
          activate.mutate([m.key], {
            onSuccess: () => toast({ title: t('activatedToast', { name: m.name }) }),
          })
        }
      >
        {t('activate', { name: m.name })}
      </Button>
    ) : (
      <Button
        variant="secondary"
        className="border-dashed border-line-dashed"
        disabled={m.interested || interest.isPending}
        onClick={() =>
          interest.mutate([m.key], {
            onSuccess: () =>
              toast({
                title: t('interestToastTitle'),
                description: t('interestToastDescription', { name: m.name }),
              }),
          })
        }
      >
        {m.interested ? t('interested') : t('notifyMe')}
      </Button>
    );

  return (
    <ModuleCard
      state={m.state}
      icon={ICONS[m.icon]}
      pill={pill}
      name={m.name}
      description={m.description}
      priceLine={m.priceLine}
      action={action}
    />
  );
}
