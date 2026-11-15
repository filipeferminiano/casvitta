import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inbox } from 'lucide-react';

import { formatBRL } from '../lib/format.ts';
import { DataTable, type DataTableColumn } from './DataTable.tsx';
import { EmptyState } from './States.tsx';

type ChannelRow = { channel: string; spendCents: number; leads: number; visits: number };

const rows: ChannelRow[] = [
  { channel: 'Instagram e Facebook', spendCents: 10_500, leads: 6, visits: 2 },
  { channel: 'Google', spendCents: 6_300, leads: 2, visits: 1 },
  { channel: 'Marketplace', spendCents: 0, leads: 3, visits: 1 },
];

const perLead = (row: Pick<ChannelRow, 'spendCents' | 'leads'>) =>
  row.leads ? formatBRL(Math.round(row.spendCents / row.leads)) : '—';

const total = rows.reduce(
  (acc, r) => ({
    spendCents: acc.spendCents + r.spendCents,
    leads: acc.leads + r.leads,
    visits: acc.visits + r.visits,
  }),
  { spendCents: 0, leads: 0, visits: 0 },
);

const columns: DataTableColumn<ChannelRow>[] = [
  { key: 'channel', header: 'Canal', cell: (r) => r.channel, total: 'Total' },
  {
    key: 'spend',
    header: 'Gasto',
    numeric: true,
    cell: (r) => formatBRL(r.spendCents),
    total: formatBRL(total.spendCents),
  },
  { key: 'leads', header: 'Leads', numeric: true, cell: (r) => r.leads, total: total.leads },
  { key: 'perLead', header: 'Custo por lead', numeric: true, cell: perLead, total: perLead(total) },
  {
    key: 'visits',
    header: 'Visitas marcadas',
    numeric: true,
    cell: (r) => r.visits,
    total: total.visits,
  },
];

const meta = {
  title: 'Foundations/DataTable',
  component: DataTable<ChannelRow>,
  args: {
    caption: 'Resultado da semana por canal',
    columns,
    rows,
    rowKey: (r: ChannelRow) => r.channel,
  },
} satisfies Meta<typeof DataTable<ChannelRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithTotals: Story = { args: { showTotals: true, showCaption: true } };
export const NarrowContainer: Story = {
  args: { showTotals: true },
  decorators: [
    (Story) => (
      <div className="max-w-[360px]">
        <Story />
      </div>
    ),
  ],
};
export const Empty: Story = {
  args: {
    rows: [],
    empty: (
      <EmptyState
        icon={<Inbox strokeWidth={1.6} />}
        title="Ainda sem resultados nesta semana"
        description="Os números aparecem aqui quando seu primeiro anúncio começar a rodar."
      />
    ),
  },
};
