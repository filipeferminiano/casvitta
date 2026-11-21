import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';

import { Button } from '../components/Button.tsx';
import { DataTable } from '../components/DataTable.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { Input } from '../components/Input.tsx';
import { Panel } from '../components/Panel.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.tsx';
import { StatusPill } from '../components/StatusPill.tsx';
import { BackofficePageHeader } from './BackofficeShell.tsx';
import { PermissionMatrix } from './PermissionMatrix.tsx';
import { Frame } from './story-frame.tsx';

const meta = {
  title: 'Backoffice/BO8 · Equipe e auditoria',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Demo data (is_demo): names and numbers from the mockups.
const team = [
  { id: '1', name: 'Filipe', email: 'filipe@…', role: 'Admin', seen: 'agora' },
  { id: '2', name: 'Marina', email: 'marina@…', role: 'Operações', seen: 'há 20 min' },
  { id: '3', name: 'Caio', email: 'caio@…', role: 'Comercial', seen: 'ontem' },
];

const audit = [
  {
    id: 'a',
    when: '20/11 09h41',
    who: 'Filipe',
    action: 'creci.verified',
    detail: 'Ana Ribeiro · CRECI-SP 000.000-F',
  },
  {
    id: 'b',
    when: '20/11 09h12',
    who: 'Marina',
    action: 'interest.assigned',
    detail: 'Paulo M. → Ana Ribeiro',
  },
  {
    id: 'c',
    when: '19/11 16h40',
    who: 'Caio',
    action: 'contact.revealed',
    detail: 'Telefone de Otávio S. · motivo: retorno comercial',
  },
];

const roles = ['Admin', 'Operações', 'Comercial', 'Financeiro', 'Leitura'];
const matrix: [string, boolean[]][] = [
  ['Verificar CRECI', [true, true, false, false, false]],
  ['Indicar corretor e tratar captações', [true, true, true, false, false]],
  ['Exportar contatos (CSV)', [true, true, true, false, false]],
  ['Moderar e pausar anúncios', [true, true, false, false, false]],
  ['Ver telefone e e-mail completos', [true, true, true, true, false]],
  ['Ver como o cliente', [true, true, false, true, false]],
  ['Assinaturas, faturas e links de pagamento', [true, false, false, true, false]],
  ['Convidar equipe e mudar papéis', [true, false, false, false, false]],
];

function TeamTable() {
  return (
    <DataTable
      caption="Equipe"
      rowKey={(r) => r.id}
      rows={team}
      columns={[
        {
          key: 'p',
          header: 'Pessoa',
          cell: (r) => (
            <div className="flex flex-col">
              <span className="font-semibold">{r.name}</span>
              <span className="type-caption">{r.email}</span>
            </div>
          ),
        },
        {
          key: 'r',
          header: 'Papel',
          cell: (r) => (
            <StatusPill tone={r.role === 'Admin' ? 'info' : 'neutral'}>{r.role}</StatusPill>
          ),
        },
        { key: 's', header: 'Último acesso', cell: (r) => r.seen },
      ]}
    />
  );
}

function Matrix() {
  return (
    <PermissionMatrix
      caption="O que cada papel pode fazer"
      permissionHeader="Permissão"
      yesLabel="Pode"
      noLabel="Não pode"
      roles={roles.map((r) => ({ key: r, label: r }))}
      rows={matrix.map(([label, cells]) => ({
        key: label,
        label,
        allowed: Object.fromEntries(roles.map((r, i) => [r, cells[i] ?? false])),
      }))}
    />
  );
}

function Screen({ auditBody }: { auditBody: ReactNode }) {
  return (
    <Frame>
      <BackofficePageHeader
        date="Sexta, 20 de novembro"
        title="Equipe e auditoria"
        description="Quem acessa o backoffice, o que cada papel pode fazer e tudo o que foi feito."
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Panel title="Equipe" aside={<Button size="sm">Convidar pessoa</Button>}>
          <TeamTable />
        </Panel>
        <Panel title="O que cada papel pode fazer">
          <Matrix />
        </Panel>
      </div>
      <Panel
        title="Auditoria"
        className="mt-5"
        aside={
          <Button size="sm" variant="secondary">
            Exportar
          </Button>
        }
      >
        {auditBody}
      </Panel>
    </Frame>
  );
}

const auditTable = (rows: typeof audit) => (
  <DataTable
    caption="Auditoria"
    rowKey={(r) => r.id}
    rows={rows}
    empty={<EmptyState title="Nada registrado com estes filtros." />}
    columns={[
      { key: 'w', header: 'Quando', cell: (r) => <span className="font-mono">{r.when}</span> },
      { key: 'q', header: 'Quem', cell: (r) => r.who },
      {
        key: 'a',
        header: 'Ação',
        cell: (r) => <span className="font-mono text-[13px]">{r.action}</span>,
      },
      { key: 'd', header: 'Detalhe', cell: (r) => r.detail },
    ]}
  />
);

export const Data: Story = { render: () => <Screen auditBody={auditTable(audit)} /> };

export const Loading: Story = {
  render: () => <Screen auditBody={<LoadingState title="Carregando a auditoria…" />} />,
};

export const Empty: Story = { render: () => <Screen auditBody={auditTable([])} /> };

export const LoadError: Story = {
  render: () => (
    <Screen
      auditBody={
        <ErrorState
          title="Não conseguimos carregar a auditoria"
          stillWorks="O resto do backoffice continua funcionando."
          howToFix="Tente de novo em alguns segundos. Se continuar, avise quem cuida da plataforma."
          primaryAction={<Button>Tentar de novo</Button>}
        />
      }
    />
  ),
};

export const ReauthCode: Story = {
  render: function ReauthStory() {
    const [open, setOpen] = useState(true);
    return (
      <Frame>
        <Button onClick={() => setOpen(true)}>Exportar</Button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Confirme que é você"
          description="Esta ação mostra ou exporta dados pessoais, ou muda acessos. Enviamos um código de 6 números para filipe@casvitta.com.br."
          closeLabel="Fechar"
        >
          <div className="flex flex-col gap-4">
            <Input
              label="Código de 6 números"
              inputMode="numeric"
              inputClassName="font-mono tracking-[0.3em]"
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button>Confirmar</Button>
            </div>
          </div>
        </Dialog>
      </Frame>
    );
  },
};
