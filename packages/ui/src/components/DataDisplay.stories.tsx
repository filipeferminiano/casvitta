import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banknote, Wallet } from 'lucide-react';

import { formatBRL } from '../lib/format.ts';
import { Badge } from './Badge.tsx';
import { Chip } from './Chip.tsx';
import { StatTile } from './StatTile.tsx';
import { StatusPill } from './StatusPill.tsx';

const meta = { title: 'Foundations/Data display' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="demo">Demonstrativo</Badge>
      <Badge variant="creci">CRECI-SP 000.000-F</Badge>
      <Badge variant="ai">Feito por IA</Badge>
      <Badge variant="simulation">Simulação · não é aprovação</Badge>
      <Badge variant="soon">Em breve</Badge>
      <Badge variant="sponsored">Destaque pago</Badge>
    </div>
  ),
};

export const Chips: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip icon={<Banknote strokeWidth={1.6} />}>Financiamento 80%</Chip>
      <Chip tone="info" icon={<Wallet strokeWidth={1.6} />}>
        Usa FGTS
      </Chip>
      <Chip tone="success">Entrada pronta</Chip>
      <Chip tone="attention">Sem renda informada</Chip>
      <Chip tone="danger">Pediu desconto</Chip>
    </div>
  ),
};

export const StatusPills: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusPill tone="success">No ar</StatusPill>
      <StatusPill tone="attention">Pausado</StatusPill>
      <StatusPill tone="neutral">Rascunho</StatusPill>
      <StatusPill tone="danger">Sem autorização</StatusPill>
      <StatusPill tone="info">Em análise</StatusPill>
    </div>
  ),
};

export const StatTiles: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      <StatTile label="Pessoas que viram" value="4.812" caption="Últimos 7 dias" />
      <StatTile
        label="Pedidos de visita"
        value="3"
        caption={`Custo até agora: ${formatBRL(9_600)}`}
        highlighted
      />
      <StatTile
        label="Custo por visita marcada"
        value={formatBRL(3_200)}
        caption="Média da semana"
        badge={<Badge variant="demo">Demonstrativo</Badge>}
      />
    </div>
  ),
};
