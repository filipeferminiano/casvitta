import type { Meta, StoryObj } from '@storybook/react-vite';
import { Megaphone, Plus, Trash2 } from 'lucide-react';

import { Button } from './Button.tsx';

const meta = {
  title: 'Foundations/Button',
  component: Button,
  args: { children: 'Publicar anúncio', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', children: 'Salvar rascunho' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Cancelar' } };
export const Danger: Story = {
  args: { variant: 'danger', children: 'Pausar anúncio', icon: <Trash2 strokeWidth={1.6} /> },
};
export const WithIcon: Story = {
  args: { icon: <Plus strokeWidth={1.6} />, children: 'Novo imóvel' },
};
export const Small: Story = { args: { size: 'sm', children: 'Ver lead' } };
export const Loading: Story = {
  args: { loading: true, loadingLabel: 'Publicando…', icon: <Megaphone strokeWidth={1.6} /> },
};
export const Disabled: Story = { args: { disabled: true } };
export const AsLink: Story = {
  args: { asChild: true, variant: 'secondary', children: <a href="#leads">Ver todos os leads</a> },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <Button variant={variant}>Publicar anúncio</Button>
          <Button variant={variant} size="sm">
            Publicar
          </Button>
          <Button variant={variant} loading loadingLabel="Publicando…">
            Publicar anúncio
          </Button>
          <Button variant={variant} disabled>
            Publicar anúncio
          </Button>
        </div>
      ))}
    </div>
  ),
};
