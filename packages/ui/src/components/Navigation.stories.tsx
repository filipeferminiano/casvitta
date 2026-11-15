import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SegmentedControl } from './SegmentedControl.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs.tsx';

const meta = { title: 'Foundations/Navigation' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function SegmentedDemo({ size }: { size?: 'md' | 'sm' }) {
  const [value, setValue] = useState('week');
  return (
    <SegmentedControl
      label="Período"
      size={size}
      value={value}
      onValueChange={setValue}
      options={[
        { value: 'day', label: 'Dia' },
        { value: 'week', label: 'Semana' },
        { value: 'month', label: 'Mês' },
        { value: 'year', label: 'Ano', disabled: true },
      ]}
    />
  );
}

export const Segmented: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <SegmentedDemo />
      <SegmentedDemo size="sm" />
    </div>
  ),
};

export const TabsWithCounts: Story = {
  render: () => (
    <Tabs defaultValue="needs-you" className="max-w-xl">
      <TabsList aria-label="Conversas">
        <TabsTrigger value="needs-you" count={2}>
          Precisa de você
        </TabsTrigger>
        <TabsTrigger value="ai" count={5}>
          IA
        </TabsTrigger>
        <TabsTrigger value="all">Todas</TabsTrigger>
        <TabsTrigger value="archived" disabled>
          Arquivadas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="needs-you">Duas conversas esperam sua resposta.</TabsContent>
      <TabsContent value="ai">A IA está atendendo cinco conversas.</TabsContent>
      <TabsContent value="all">Todas as conversas.</TabsContent>
    </Tabs>
  ),
};
