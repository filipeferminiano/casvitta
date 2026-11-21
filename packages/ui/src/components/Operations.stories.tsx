import type { Meta, StoryObj } from '@storybook/react-vite';
import { Megaphone, FileText, Users } from 'lucide-react';

import { Button } from './Button.tsx';
import { CalendarWeek } from './CalendarWeek.tsx';
import { ModuleCard } from './ModuleCard.tsx';
import { StatusPill } from './StatusPill.tsx';

const meta = { title: 'Domain/Operations' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Calendar: Story = {
  render: () => (
    <CalendarWeek
      className="max-w-3xl"
      label="Semana de 16 a 20 de novembro"
      days={[
        { key: 'mon', label: 'Seg 16', isToday: true },
        { key: 'tue', label: 'Ter 17' },
        { key: 'wed', label: 'Qua 18' },
        { key: 'thu', label: 'Qui 19' },
      ]}
      rows={[
        { key: '09h', label: '09h' },
        { key: '10h', label: '10h' },
        { key: '14h', label: '14h' },
        { key: '17h', label: '17h' },
      ]}
      items={[
        {
          id: '1',
          day: 'thu',
          row: '09h',
          state: 'blocked',
          title: 'Bloqueado',
          subtitle: 'pessoal',
        },
        {
          id: '2',
          day: 'mon',
          row: '10h',
          state: 'confirmed',
          title: 'Rafael M.',
          subtitle: 'Apto Vila Mariana',
        },
        { id: '3', day: 'wed', row: '10h', state: 'free', title: 'Livre' },
        {
          id: '4',
          day: 'mon',
          row: '14h',
          state: 'task',
          title: 'Captação',
          subtitle: 'Apto Perdizes',
        },
        {
          id: '5',
          day: 'mon',
          row: '17h',
          state: 'awaiting',
          title: 'Carla D.',
          subtitle: 'Casa Saúde',
        },
        {
          id: '6',
          day: 'tue',
          row: '17h',
          state: 'selected',
          title: 'Marcos T. · Apto Vila Mariana',
        },
        {
          id: '7',
          day: 'wed',
          row: '17h',
          state: 'done',
          title: 'Bianca S.',
          subtitle: 'visita feita',
        },
      ]}
    />
  ),
};

export const ModuleCards: Story = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-3 gap-4">
      <ModuleCard
        state="active"
        icon={<Users strokeWidth={1.6} />}
        pill={<StatusPill tone="success">Ativo</StatusPill>}
        name="CRM e WhatsApp"
        description="Leads, conversas, agenda, propostas e suas landing pages."
        priceLine="Plano Corretor · R$ 99/mês"
        action={<Button variant="secondary">Gerenciar</Button>}
      />
      <ModuleCard
        state="available"
        icon={<Megaphone strokeWidth={1.6} />}
        pill={<StatusPill tone="info">Disponível</StatusPill>}
        name="Anúncios"
        description="Anúncio pronto por IA no marketplace, Meta e Google."
        priceLine="Mídia a partir de R$ 20/dia por imóvel"
        action={<Button>Ativar Anúncios</Button>}
      />
      <ModuleCard
        state="soon"
        icon={<FileText strokeWidth={1.6} />}
        pill={<StatusPill>Em breve</StatusPill>}
        name="Contratos"
        description="Modelos guiados e assinatura eletrônica."
        priceLine="Preço a definir"
        action={<Button variant="secondary">Quero ser avisado</Button>}
      />
    </div>
  ),
};
