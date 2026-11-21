import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../components/Button.tsx';
import { FunnelBars } from '../components/FunnelBars.tsx';
import { Panel } from '../components/Panel.tsx';
import { StatTile } from '../components/StatTile.tsx';
import { ErrorState, LoadingState } from '../components/States.tsx';
import { BackofficePageHeader } from './BackofficeShell.tsx';
import { ActivityList, QueueList } from './Overview.tsx';
import { Frame } from './story-frame.tsx';

const meta = {
  title: 'Backoffice/BO1 · Visão geral',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Demo data (is_demo): numbers from the mockup.
function Header() {
  return (
    <BackofficePageHeader
      date="Sexta, 20 de novembro"
      title="Bom dia, Filipe"
      description="O que precisa de alguém da equipe hoje, e como o funil de corretores está andando."
    />
  );
}

function Body({ empty = false }: { empty?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Corretores cadastrados" value="148" caption="+11 nesta semana" />
        <StatTile label="CRECI pendentes" value="12" attention caption="3 há mais de 24 h" />
        <StatTile label="Captações em 7 dias" value="119" caption="86 de leilão" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5">
        <Panel title="Precisa de você">
          {empty ? (
            <p className="type-body text-fg-muted">Nada esperando a equipe agora.</p>
          ) : (
            <QueueList
              openLabel="Abrir"
              linkLabel={(i) => `Abrir ${String(i.title)} (${i.count})`}
              items={[
                {
                  key: 'creci',
                  title: 'CRECI para verificar',
                  description: '3 passaram de 24 h, o prazo prometido no cadastro',
                  count: 12,
                  href: '#',
                  tone: 'attention',
                },
                {
                  key: 'owners',
                  title: 'Pedidos de proprietário sem corretor',
                  description: 'Indicar um corretor verificado da região',
                  count: 5,
                  href: '#',
                  tone: 'attention',
                },
                {
                  key: 'investors',
                  title: 'Gestores e family offices aguardando conversa',
                  description: 'Formulário de investidores institucionais',
                  count: 3,
                  href: '#',
                  tone: 'neutral',
                },
              ]}
            />
          )}
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel title="Do cadastro ao assinante">
            <FunnelBars
              label="Do cadastro ao assinante"
              items={[
                { key: 'a', label: 'Cadastro iniciado', value: 148 },
                { key: 'b', label: 'CRECI enviado', value: 109 },
                { key: 'c', label: 'CRECI verificado', value: 97 },
              ]}
              caption="Os próximos passos aparecem quando imóveis e cobrança estiverem no banco."
            />
          </Panel>
          <Panel title="Atividade da equipe">
            <ActivityList
              items={[
                { key: '1', time: '09h41', actor: 'Filipe', text: 'verificou o CRECI 000.000-F' },
                {
                  key: '2',
                  time: '09h12',
                  actor: 'Marina',
                  text: 'indicou Rafael Souza para o pedido de Paulo M.',
                },
              ]}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

export const Data: Story = {
  render: () => (
    <Frame current="overview">
      <Header />
      <Body />
    </Frame>
  ),
};

export const NothingWaiting: Story = {
  render: () => (
    <Frame current="overview">
      <Header />
      <Body empty />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame current="overview">
      <Header />
      <LoadingState title="Carregando a visão geral…" />
    </Frame>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Frame current="overview">
      <Header />
      <ErrorState
        title="Não conseguimos carregar a visão geral"
        stillWorks="O resto do backoffice continua funcionando."
        howToFix="Tente de novo em alguns segundos. Se continuar, avise quem cuida da plataforma."
        primaryAction={<Button>Tentar de novo</Button>}
      />
    </Frame>
  ),
};
