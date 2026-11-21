import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../components/Badge.tsx';
import { Callout } from '../components/Callout.tsx';
import { Panel } from '../components/Panel.tsx';
import { EmptyState, LoadingState } from '../components/States.tsx';
import { BackofficePageHeader } from './BackofficeShell.tsx';
import { CheckList } from './CheckList.tsx';
import { Frame } from './story-frame.tsx';

const meta = {
  title: 'Backoffice/BO6–BO7 · Liga depois',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function ModerationHeader() {
  return (
    <BackofficePageHeader
      date="Sexta, 20 de novembro"
      title="Moderação de anúncios"
      description="O marketplace só mostra imóvel com CRECI verificado e autorização válida. Aqui ficam as exceções e as denúncias."
    />
  );
}

export const ModerationOff: Story = {
  render: () => (
    <Frame current="moderation">
      <ModerationHeader />
      <EmptyState
        title="Liga quando imóveis e anúncios estiverem no banco"
        description="As checagens automáticas já estão prontas. Só o que falhar em alguma delas, ou receber denúncia, vai aparecer aqui; o resto publica direto."
      />
    </Frame>
  ),
};

/** The designed state, with demo data, for when listings exist. */
export const ModerationWithListings: Story = {
  render: () => (
    <Frame current="moderation">
      <ModerationHeader />
      <Panel title="Apto · Rua Joaquim Távora" aside={<Badge variant="demo">Demonstrativo</Badge>}>
        <p className="mb-3 type-body-s text-fg-muted">Bianca Lopes · R$ 520.000</p>
        <CheckList
          title="Checagens automáticas"
          items={[
            {
              key: 'creci',
              label: 'CRECI do corretor verificado',
              outcome: 'ok',
              outcomeLabel: 'OK',
            },
            {
              key: 'auth',
              label: 'Autorização válida até 10/03/2027',
              outcome: 'ok',
              outcomeLabel: 'OK',
            },
            {
              key: 'price',
              label: 'Preço 27% abaixo da mediana de 14 comparáveis (R$ 712.000)',
              outcome: 'review',
              outcomeLabel: 'Revisar',
            },
            {
              key: 'photos',
              label: 'Fotos sem texto excessivo',
              outcome: 'ok',
              outcomeLabel: 'OK',
            },
            {
              key: 'dup',
              label: 'Não duplica outro anúncio ativo',
              outcome: 'ok',
              outcomeLabel: 'OK',
            },
          ]}
        />
      </Panel>
    </Frame>
  ),
};

export const ModerationLoading: Story = {
  render: () => (
    <Frame current="moderation">
      <ModerationHeader />
      <LoadingState title="Carregando a moderação…" />
    </Frame>
  ),
};

export const RevenueOff: Story = {
  render: () => (
    <Frame current="revenue">
      <BackofficePageHeader
        date="Sexta, 20 de novembro"
        title="Receita"
        description="Quanto entra por linha: assinaturas, anúncios e, depois, comissões de aluguel e venda."
      />
      <Callout tone="info" className="mb-5">
        Assinaturas e anúncios passam a ler a Stripe quando a cobrança for ligada; até lá não há
        valores. Mídia nunca entra: a Meta e o Google cobram o corretor direto.
      </Callout>
      <EmptyState title="Liga quando a cobrança for ativada." />
    </Frame>
  ),
};
