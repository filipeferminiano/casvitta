import type { Meta, StoryObj } from '@storybook/react-vite';
import { Users } from 'lucide-react';

import { Button } from './Button.tsx';
import { EmptyState, ErrorState, LoadingState } from './States.tsx';

const meta = { title: 'Foundations/States' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={<Users strokeWidth={1.6} />}
      title="Nenhum lead ainda"
      description="Leads aparecem aqui quando alguém responde a um anúncio seu. Publique o primeiro imóvel para começar."
      actions={<Button>Publicar imóvel</Button>}
    />
  ),
};

export const EmptyWithoutAction: Story = {
  render: () => <EmptyState title="Nada para revisar" description="Tudo em dia por aqui." />,
};

export const Loading: Story = {
  render: () => <LoadingState title="Carregando seus leads" description="Leva alguns segundos." />,
};

export const Error: Story = {
  render: () => (
    <ErrorState
      title="A Meta recusou o anúncio."
      stillWorks="O marketplace e o Google seguem no ar."
      howToFix="A foto 3 tem texto acima do limite. Troque a foto e envie de novo."
      primaryAction={<Button>Trocar foto</Button>}
      secondaryAction={<Button variant="secondary">Publicar sem Instagram</Button>}
    />
  ),
};
