import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarDays, FileText, Megaphone, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from './Avatar.tsx';
import { Badge } from './Badge.tsx';
import { Chip } from './Chip.tsx';
import { FinancingSimulation } from './FinancingSimulation.tsx';
import { FunnelBars } from './FunnelBars.tsx';
import { KanbanBoard, type KanbanColumn } from './KanbanBoard.tsx';
import { cardLinkClass, LeadCard } from './LeadCard.tsx';
import { Panel, PanelList } from './Panel.tsx';
import { QualificationPanel } from './QualificationPanel.tsx';
import { StageProgress } from './StageProgress.tsx';
import { StatusPill } from './StatusPill.tsx';
import { Timeline } from './Timeline.tsx';

const meta = { title: 'Domain/Leads' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const LeadCards: Story = {
  render: () => (
    <div className="grid max-w-[460px] grid-cols-2 gap-3">
      <LeadCard
        name={
          <a href="#lucas" className={cardLinkClass}>
            Lucas F.
          </a>
        }
        cost="R$ 12"
        origin="Instagram · Apto Vila Mariana"
        chips={<Chip tone="info">IA atendendo</Chip>}
        note="há 8 min"
      />
      <LeadCard
        needsHuman
        name="Júlia P."
        origin="Marketplace · Apto Vila Mariana"
        chips={<Chip tone="attention">Pediu desconto</Chip>}
        note="IA passou para você"
      />
      <LeadCard
        name="Carla D."
        cost="R$ 35"
        origin="Google · Casa Saúde"
        chips={
          <>
            <Chip>FGTS</Chip>
            <Chip tone="info">Financia 70%</Chip>
          </>
        }
        note="visita sugerida hoje 17h"
      />
      <LeadCard
        name="Pedro A."
        origin="Indicação · Apto Vila Mariana"
        note="enviada ao proprietário"
      />
    </div>
  ),
};

type Card = { id: string; name: string; origin: string };
const initial: KanbanColumn<Card>[] = [
  {
    key: 'new',
    title: 'Novo',
    items: [
      { id: '1', name: 'Lucas F.', origin: 'Instagram' },
      { id: '2', name: 'Sônia R.', origin: 'Marketplace' },
      { id: '3', name: 'Felipe G.', origin: 'Google' },
    ],
  },
  {
    key: 'qualifying',
    title: 'Em qualificação',
    items: [{ id: '4', name: 'Júlia P.', origin: 'Marketplace' }],
  },
  { key: 'qualified', title: 'Qualificado', items: [] },
];

function KanbanDemo() {
  const [columns, setColumns] = useState(initial);
  return (
    <KanbanBoard
      label="Funil de leads"
      columns={columns}
      itemKey={(c) => c.id}
      itemLabel={(c) => c.name}
      renderItem={(c, menu) => <LeadCard name={c.name} origin={c.origin} menu={menu} />}
      onMove={(id, to) =>
        setColumns((cols) => {
          const card = cols.flatMap((c) => c.items).find((i) => i.id === id)!;
          return cols.map((c) => ({
            ...c,
            items:
              c.key === to
                ? [card, ...c.items.filter((i) => i.id !== id)]
                : c.items.filter((i) => i.id !== id),
          }));
        })
      }
      copy={{
        moveTo: 'Mover para…',
        moveMenuLabel: (n) => `Mover ${n} para outra etapa`,
        showMore: (n) => `+${n} leads`,
        showLess: 'Mostrar menos',
        moved: (n, c) => `${n} movido para ${c}`,
        empty: 'Nenhum lead nesta etapa',
      }}
    />
  );
}

export const Kanban: Story = { render: () => <KanbanDemo /> };

export const TimelineHistory: Story = {
  render: () => (
    <Timeline
      className="max-w-xl"
      items={[
        {
          key: '1',
          icon: <FileText />,
          tone: 'action',
          time: '16/11 · 09h12',
          title: 'Proposta registrada',
          detail: 'R$ 672.000, financiamento de 80% com FGTS.',
        },
        {
          key: '2',
          icon: <CalendarDays />,
          tone: 'success',
          time: '14/11 · 10h',
          title: 'Visita feita',
          detail: 'Com a esposa. Duração 45 min.',
        },
        {
          key: '3',
          icon: <Sparkles />,
          tone: 'action',
          time: '11/11 · 14h03',
          title: 'Qualificado pela IA',
        },
        {
          key: '4',
          icon: <Megaphone />,
          tone: 'attention',
          time: '11/11 · 14h01',
          title: 'Chegou pelo Instagram',
        },
      ]}
    />
  ),
};

export const Stages: Story = {
  render: () => (
    <StageProgress
      label="Etapa do lead"
      current="proposal"
      stages={[
        { key: 'new', label: 'Novo' },
        { key: 'qualified', label: 'Qualificado' },
        { key: 'visit_booked', label: 'Visita marcada' },
        { key: 'visit_done', label: 'Visita feita' },
        { key: 'proposal', label: 'Proposta' },
        { key: 'won', label: 'Fechado' },
      ]}
    />
  ),
};

export const Qualification: Story = {
  render: () => (
    <QualificationPanel
      className="max-w-sm"
      title="Qualificação"
      status={<StatusPill tone="success">Qualificado</StatusPill>}
      rows={[
        { key: 'f', label: 'Financiamento', value: 'Sim, ~80%' },
        { key: 'g', label: 'FGTS', value: 'Sim, ~R$ 60 mil' },
        { key: 'e', label: 'Entrada total', value: '~R$ 138 mil (20%)' },
        { key: 'r', label: 'Renda familiar informada', value: '~R$ 22 mil' },
        { key: 'p', label: 'Prazo de compra', value: 'Até 3 meses' },
      ]}
      footnote="Respostas do lead, não verificadas."
    />
  ),
};

export const Simulation: Story = {
  render: () => (
    <FinancingSimulation
      className="max-w-sm"
      title="Simulação"
      badge={<Badge variant="simulation">Simulação · não é aprovação</Badge>}
      context="Sobre a proposta de R$ 672 mil"
      result="R$ 6.349/mês"
      details="1ª parcela SAC · 360 meses · 11,5% a.a. ilustrativa · 28,9% da renda · sem seguros e tarifas"
    />
  ),
};

export const PanelsAndFunnel: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <Panel
        title="Precisa de você"
        aside={<span className="font-mono type-caption">2 itens</span>}
        flush
      >
        <PanelList className="mx-5 mb-2">
          <li className="flex items-center gap-3 py-4">
            <Avatar name="Júlia P." />
            Júlia P. pediu desconto
          </li>
          <li className="flex items-center gap-3 py-4">
            <Avatar name="Marcos T." />
            Duas propostas no Apto Vila Mariana
          </li>
        </PanelList>
      </Panel>
      <Panel title="Funil agora">
        <FunnelBars
          label="Funil"
          items={[
            { key: 'n', label: 'Novo', value: 6 },
            { key: 'q', label: 'Qualificado', value: 5 },
            { key: 'v', label: 'Visita marcada', value: 4 },
            { key: 'p', label: 'Proposta', value: 2 },
          ]}
        />
      </Panel>
      <Panel title="Do alcance à visita" className="md:col-span-2">
        <FunnelBars
          label="Do alcance à visita"
          log
          highlightLast
          caption="Escala logarítmica para caber o alcance e as visitas na mesma régua."
          items={[
            { key: 'r', label: 'Pessoas alcançadas', value: 9840, display: '9.840' },
            { key: 'c', label: 'Cliques no anúncio', value: 286 },
            { key: 'q', label: 'Qualificados', value: 6 },
            { key: 'v', label: 'Visitas agendadas', value: 3 },
          ]}
        />
      </Panel>
      <Panel title="Em breve" dashed>
        Conteúdo de um módulo que ainda não está disponível.
      </Panel>
    </div>
  ),
};
