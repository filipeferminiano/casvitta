import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Panel } from '../components/Panel.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.tsx';
import { StatusPill } from '../components/StatusPill.tsx';
import { Tabs, TabsList, TabsTrigger } from '../components/Tabs.tsx';
import { BackofficePageHeader } from './BackofficeShell.tsx';
import { QueueTable } from './QueueTable.tsx';
import { Frame } from './story-frame.tsx';

const meta = {
  title: 'Backoffice/BO2 · Verificação de CRECI',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Demo data (is_demo) from the mockup.
type Row = {
  id: string;
  name: string;
  sub: string;
  creci: string;
  hours: number;
  resent?: boolean;
};
const rows: Row[] = [
  {
    id: '1',
    name: 'Ana Ribeiro',
    sub: 'ana@… · São Paulo',
    creci: 'CRECI-SP 000.000-F',
    hours: 26,
  },
  {
    id: '2',
    name: 'Rafael Souza',
    sub: 'rafael@… · Santo André',
    creci: 'CRECI-SP 000.001-F',
    hours: 25,
  },
  {
    id: '3',
    name: 'Imob. Vila Nova',
    sub: 'contato@… · São Paulo',
    creci: 'CRECI-SP 00.000-J',
    hours: 24,
    resent: true,
  },
  {
    id: '4',
    name: 'Carla Mendes',
    sub: 'carla@… · Campinas',
    creci: 'CRECI-SP 000.002-F',
    hours: 6,
  },
];

function Header() {
  return (
    <>
      <BackofficePageHeader
        date="Sexta, 20 de novembro"
        title="Verificação de CRECI"
        description="Nenhum corretor publica antes desta aprovação."
      />
      <Tabs value="pending">
        <TabsList className="mb-5">
          <TabsTrigger value="pending" count={12}>
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="c" count={4}>
            Correção pedida
          </TabsTrigger>
          <TabsTrigger value="v" count={97}>
            Verificados
          </TabsTrigger>
          <TabsTrigger value="r" count={3}>
            Recusados
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </>
  );
}

function Detail() {
  const [checks, setChecks] = useState([true, true, false, false]);
  return (
    <Panel>
      <h2 className="type-title text-[22px]">Ana Ribeiro</h2>
      <p className="type-body-s text-fg-muted">Cadastro em 19/11 · plano Corretor escolhido</p>
      <Button variant="secondary" className="mt-4 w-full">
        Abrir consulta pública do CRECI-SP
      </Button>
      <fieldset className="mt-4 border-t border-line pt-3">
        <legend className="type-body-s font-semibold">Conferência</legend>
        {[
          'Número existe na consulta pública do CRECI-SP',
          'Nome no registro confere com o cadastro',
          'Inscrição ativa, sem suspensão',
          'Tipo confere (F pessoa física, J imobiliária)',
        ].map((label, i) => (
          <Checkbox
            key={label}
            label={label}
            checked={checks[i]}
            onCheckedChange={(v) => setChecks((c) => c.map((x, j) => (j === i ? v === true : x)))}
          />
        ))}
      </fieldset>
      <div className="mt-4 flex flex-col gap-3">
        <Button disabled={!checks.every(Boolean)}>Aprovar CRECI</Button>
        <div className="flex gap-3">
          <Button variant="secondary">Pedir correção</Button>
          <Button variant="danger">Recusar</Button>
        </div>
      </div>
    </Panel>
  );
}

function Queue({ items }: { items: Row[] }) {
  const [selected, setSelected] = useState(items[0]?.id ?? null);
  return (
    <QueueTable
      caption="Verificação de CRECI"
      rows={items}
      rowKey={(r) => r.id}
      selectedKey={selected}
      onSelect={(r) => setSelected(r.id)}
      selectLabel={(r) => `Ver ${r.name}`}
      primary={{
        key: 'n',
        header: 'Corretor',
        cell: (r) => (
          <>
            <span className="font-semibold text-fg">{r.name}</span>
            <span className="type-caption">{r.sub}</span>
          </>
        ),
      }}
      columns={[
        { key: 'c', header: 'CRECI informado', cell: (r) => r.creci },
        {
          key: 'h',
          header: 'Na fila',
          cell: (r) => (
            <StatusPill tone={r.hours >= 24 ? 'danger' : r.hours >= 6 ? 'attention' : 'success'}>
              há {r.hours} h
            </StatusPill>
          ),
        },
        {
          key: 's',
          header: 'Situação',
          cell: (r) =>
            r.resent ? (
              <StatusPill tone="info">Correção enviada</StatusPill>
            ) : (
              <StatusPill>Primeira análise</StatusPill>
            ),
        },
      ]}
      empty={<EmptyState title="Nenhum CRECI esperando análise." />}
    />
  );
}

export const Data: Story = {
  render: () => (
    <Frame current="creci">
      <Header />
      <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-5">
        <Queue items={rows} />
        <Detail />
      </div>
    </Frame>
  ),
};

export const Empty: Story = {
  render: () => (
    <Frame current="creci">
      <Header />
      <Queue items={[]} />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame current="creci">
      <Header />
      <LoadingState title="Carregando a fila de CRECI…" />
    </Frame>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Frame current="creci">
      <Header />
      <ErrorState
        title="Não conseguimos carregar a fila de CRECI"
        stillWorks="O resto do backoffice continua funcionando."
        howToFix="Tente de novo em alguns segundos."
        primaryAction={<Button>Tentar de novo</Button>}
      />
    </Frame>
  ),
};
