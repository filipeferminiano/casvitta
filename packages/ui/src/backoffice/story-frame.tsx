/** Storybook only: the backoffice frame with demo navigation (names and counts from the mockups). */
import { ClipboardList, FileText, House, LayoutGrid, Receipt, Settings, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { Input } from '../components/Input.tsx';
import { BackofficeShell, EnvironmentBadge, type BackofficeNavGroup } from './BackofficeShell.tsx';

const groups = (current: string): BackofficeNavGroup[] =>
  [
    {
      key: 'home',
      items: [{ key: 'overview', href: '#', label: 'Visão geral', icon: House }],
    },
    {
      key: 'ops',
      label: 'Operação',
      items: [
        {
          key: 'creci',
          href: '#',
          label: 'Verificação de CRECI',
          icon: FileText,
          count: 12,
          countTone: 'attention' as const,
        },
        {
          key: 'captures',
          href: '#',
          label: 'Captações',
          icon: Users,
          count: 119,
          countTone: 'neutral' as const,
        },
        { key: 'moderation', href: '#', label: 'Moderação de anúncios', icon: ClipboardList },
      ],
    },
    {
      key: 'clients',
      label: 'Clientes',
      items: [
        { key: 'accounts', href: '#', label: 'Corretores e imobiliárias', icon: LayoutGrid },
        { key: 'revenue', href: '#', label: 'Receita e assinaturas', icon: Receipt },
      ],
    },
    {
      key: 'system',
      label: 'Sistema',
      items: [{ key: 'team', href: '#', label: 'Equipe e auditoria', icon: Settings }],
    },
  ].map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, current: i.key === current })) }));

export function Frame({ current = 'team', children }: { current?: string; children: ReactNode }) {
  return (
    <BackofficeShell
      brand="CASVITTA"
      badge="BACKOFFICE"
      homeHref="#"
      homeLabel="Visão geral do backoffice"
      navLabel="Backoffice"
      skipLabel="Pular para o conteúdo"
      groups={groups(current)}
      search={
        <Input
          label="Buscar"
          className="[&>label]:sr-only"
          placeholder="Buscar corretor, CRECI, telefone, e-mail ou imóvel"
        />
      }
      badges={
        <>
          <EnvironmentBadge environment="production" label="Produção" />
        </>
      }
      footer={
        <div className="flex flex-col">
          <span className="text-white">Filipe · Admin</span>
          <span>Toda ação fica registrada</span>
        </div>
      }
    >
      {children}
    </BackofficeShell>
  );
}
