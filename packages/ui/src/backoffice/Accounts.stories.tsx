import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../components/Button.tsx';
import { DataTable } from '../components/DataTable.tsx';
import { Panel } from '../components/Panel.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.tsx';
import { StatusPill } from '../components/StatusPill.tsx';
import { BackofficePageHeader } from './BackofficeShell.tsx';
import { Frame } from './story-frame.tsx';

const meta = {
  title: 'Backoffice/BO4–BO5 · Contas',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Demo data (is_demo). Only columns with data today: no subscription, properties or health yet.
const rows = [
  {
    id: '1',
    name: 'Ana Ribeiro',
    sub: 'Autônomo · São Paulo · 1 pessoa',
    plan: 'Corretor',
    creci: 'Verificado',
    access: 'hoje',
  },
  {
    id: '2',
    name: 'Imob. Vila Nova',
    sub: 'Imobiliária · São Paulo · 4 pessoas',
    plan: 'Equipe',
    creci: 'Em análise',
    access: 'há 2 dias',
  },
  {
    id: '3',
    name: 'Rafael Souza',
    sub: 'Autônomo · Santo André · 1 pessoa',
    plan: 'Corretor',
    creci: 'Em análise',
    access: 'há 8 dias',
  },
];

function List({ items }: { items: typeof rows }) {
  return (
    <DataTable
      caption="Corretores e imobiliárias"
      rowKey={(r) => r.id}
      rows={items}
      empty={<EmptyState title="Nenhuma conta com este filtro." />}
      columns={[
        {
          key: 'a',
          header: 'Conta',
          cell: (r) => (
            <div className="flex flex-col">
              <a href="#" className="font-semibold">
                {r.name}
              </a>
              <span className="type-caption">{r.sub}</span>
            </div>
          ),
        },
        { key: 'p', header: 'Plano', cell: (r) => r.plan },
        {
          key: 'c',
          header: 'CRECI',
          cell: (r) => (
            <StatusPill tone={r.creci === 'Verificado' ? 'success' : 'attention'}>
              {r.creci}
            </StatusPill>
          ),
        },
        { key: 'l', header: 'Último acesso', cell: (r) => r.access },
      ]}
    />
  );
}

function Header() {
  return (
    <BackofficePageHeader
      date="Sexta, 20 de novembro"
      title="Corretores e imobiliárias"
      description="Todas as contas, com plano escolhido, CRECI e último acesso."
    />
  );
}

export const AccountsData: Story = {
  render: () => (
    <Frame current="accounts">
      <Header />
      <List items={rows} />
    </Frame>
  ),
};
export const AccountsEmpty: Story = {
  render: () => (
    <Frame current="accounts">
      <Header />
      <List items={[]} />
    </Frame>
  ),
};
export const AccountsLoading: Story = {
  render: () => (
    <Frame current="accounts">
      <Header />
      <LoadingState title="Carregando as contas…" />
    </Frame>
  ),
};
export const AccountsError: Story = {
  render: () => (
    <Frame current="accounts">
      <Header />
      <ErrorState
        title="Não conseguimos carregar as contas"
        stillWorks="O resto do backoffice continua funcionando."
        howToFix="Tente de novo em alguns segundos."
        primaryAction={<Button>Tentar de novo</Button>}
      />
    </Frame>
  ),
};

/** BO5 with the empty states for what billing and listings will bring ("liga depois"). */
export const Account360LaterData: Story = {
  render: () => (
    <Frame current="accounts">
      <BackofficePageHeader
        date="Sexta, 20 de novembro"
        title="Imob. Vila Nova"
        description="Imobiliária · 4 pessoas · cliente desde 02/09/2026 · São Paulo"
      />
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5">
        <Panel title="Assinatura e faturas" dashed>
          <p className="type-body-s text-fg-muted">
            Liga quando a cobrança for ativada. Nenhuma fatura existe ainda.
          </p>
        </Panel>
        <Panel title="Ações">
          <div className="flex flex-col gap-3">
            <Button disabled>Enviar link de pagamento</Button>
            <Button variant="secondary">Ver como o cliente (somente leitura)</Button>
            <Button variant="danger">Pausar publicações</Button>
          </div>
        </Panel>
      </div>
    </Frame>
  ),
};
