import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Badge } from '../components/Badge.tsx';
import { Button } from '../components/Button.tsx';
import { Panel } from '../components/Panel.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.tsx';
import { StatusPill } from '../components/StatusPill.tsx';
import { BackofficePageHeader } from './BackofficeShell.tsx';
import { QueueTable } from './QueueTable.tsx';
import { Frame } from './story-frame.tsx';

const meta = {
  title: 'Backoffice/BO3 · Captações',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Demo data (is_demo) from the mockup. Phones are always masked in lists.
type Row = {
  id: string;
  name: string;
  phone: string;
  wants: string;
  origin: string;
  optIn: boolean;
  state: string;
};
const rows: Row[] = [
  {
    id: '1',
    name: 'Paulo M.',
    phone: '(11) 9····-··12',
    wants: 'Vender · Apto 2 qts · 68 m²',
    origin: 'Google / orgânico',
    optIn: true,
    state: 'Sem corretor',
  },
  {
    id: '2',
    name: 'Regina L.',
    phone: '(11) 9····-··88',
    wants: 'Alugar · Casa 3 qts',
    origin: 'Instagram / anúncio',
    optIn: true,
    state: 'Sem corretor',
  },
  {
    id: '3',
    name: 'Otávio S.',
    phone: '(11) 9····-··40',
    wants: 'Vender · Apto 3 qts',
    origin: 'Direto',
    optIn: false,
    state: 'Sem corretor',
  },
  {
    id: '4',
    name: 'Marcos A.',
    phone: '(11) 9····-··63',
    wants: 'Alugar · Studio',
    origin: 'Indicação',
    optIn: true,
    state: 'Indicado: Ana R.',
  },
];

function Header() {
  return (
    <BackofficePageHeader
      date="Sexta, 20 de novembro"
      title="Captações"
      description="Tudo o que chega pelas páginas de captura, por tipo. Pedidos de proprietário precisam de um corretor indicado."
    />
  );
}

function Table({ items }: { items: Row[] }) {
  const [selected, setSelected] = useState(items[0]?.id ?? null);
  return (
    <QueueTable
      caption="Captações"
      rows={items}
      rowKey={(r) => r.id}
      selectedKey={selected}
      onSelect={(r) => setSelected(r.id)}
      selectLabel={(r) => `Ver pedido de ${r.name}`}
      primary={{
        key: 'p',
        header: 'Pessoa',
        cell: (r) => (
          <>
            <span className="font-semibold text-fg">{r.name}</span>
            <span className="font-mono type-caption">{r.phone}</span>
            <Badge variant="demo" className="mt-0.5">
              Demonstrativo
            </Badge>
          </>
        ),
      }}
      columns={[
        { key: 'w', header: 'O que quer', cell: (r) => r.wants },
        { key: 'o', header: 'Origem', cell: (r) => r.origin },
        {
          key: 'z',
          header: 'WhatsApp',
          cell: (r) =>
            r.optIn ? (
              <StatusPill tone="success">Confirmado</StatusPill>
            ) : (
              <StatusPill>Aguardando SIM</StatusPill>
            ),
        },
        {
          key: 's',
          header: 'Status',
          cell: (r) => (
            <StatusPill tone={r.state.startsWith('Indicado') ? 'info' : 'attention'}>
              {r.state}
            </StatusPill>
          ),
        },
      ]}
      empty={<EmptyState title="Nada com estes filtros." />}
    />
  );
}

function Detail() {
  return (
    <Panel>
      <h2 className="type-title text-[22px]">Paulo M. quer vender</h2>
      <p className="type-body-s text-fg-muted">Pedido em 19/11 às 21h14 · /anunciar-imovel</p>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <div>
          <p className="type-caption">WhatsApp</p>
          <p className="font-mono type-body-s font-semibold">(11) 9····-··12</p>
        </div>
        <Button size="sm" variant="ghost" className="text-action">
          Ver completo
        </Button>
      </div>
      <h3 className="mt-4 border-t border-line pt-4 type-body font-semibold">Indicar corretor</h3>
      <p className="type-caption">Só corretores com CRECI verificado.</p>
      <Button className="mt-3 w-full">Indicar Ana Ribeiro</Button>
      <p className="mt-3 type-caption">
        A pessoa corretora recebe o pedido por e-mail e tem 24 h para aceitar; só depois recebe o
        contato do proprietário.
      </p>
    </Panel>
  );
}

export const OwnerRequests: Story = {
  render: () => (
    <Frame current="captures">
      <Header />
      <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-5">
        <Table items={rows} />
        <Detail />
      </div>
    </Frame>
  ),
};

export const Empty: Story = {
  render: () => (
    <Frame current="captures">
      <Header />
      <Table items={[]} />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame current="captures">
      <Header />
      <LoadingState title="Carregando as captações…" />
    </Frame>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Frame current="captures">
      <Header />
      <ErrorState
        title="Não conseguimos carregar as captações"
        stillWorks="O resto do backoffice continua funcionando."
        howToFix="Tente de novo em alguns segundos."
        primaryAction={<Button>Tentar de novo</Button>}
      />
    </Frame>
  ),
};
