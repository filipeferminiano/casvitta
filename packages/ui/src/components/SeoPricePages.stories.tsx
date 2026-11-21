import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './Badge.tsx';
import { MonthlySeriesChart, type MonthlyPoint } from './MonthlySeriesChart.tsx';
import {
  BuildingFactsRow,
  BuildingList,
  IncomeNeededResult,
  OwnerCTA,
  SalesPerYearBars,
  StickyResultBar,
  StockBlock,
  StreetQuickLinks,
  TurnoverLine,
  ZoneFilter,
} from './SeoBlocks.tsx';
import {
  AreaBandTable,
  BuildingTable,
  NeighborComparisonTable,
  NeighborIncomeTable,
  SegmentTable,
} from './SeoTables.tsx';
import { Tooltip, TooltipProvider } from './Tooltip.tsx';

const meta = {
  title: 'Domain/SEO pages A',
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="flex max-w-3xl flex-col gap-4">
          <Badge variant="demo">Demonstrativo</Badge>
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const priceM2Header = (
  <span className="inline-flex items-center gap-1">
    R$/m² (IPTU)
    <Tooltip
      label="O que é R$/m² de área construída (IPTU)?"
      content="Inclui a parte das áreas comuns; por isso é menor que o m² dos anúncios."
    />
  </span>
);
const simulation = <Badge variant="simulation">Simulação · não é aprovação</Badge>;

// --- 04 Neighborhood price ------------------------------------------------------------------

const points: MonthlyPoint[] = Array.from({ length: 60 }, (_, i) => {
  const year = 2021 + Math.floor((i + 8) / 12);
  const month = ((i + 8) % 12) + 1;
  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    value: i === 14 ? null : 6100 + i * 14,
    count: 140 + ((i * 37) % 60),
  };
});
const chartProps = {
  points,
  formatValue: (v: number) => `R$ ${v.toLocaleString('pt-BR')}`,
  formatMonth: (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`,
  title: 'R$/m² e vendas por mês, últimos 5 anos',
  countLabel: 'Vendas no mês',
  valueLabel: 'R$/m² (IPTU)',
  valueKind: 'mediana móvel de 12 meses',
  monthLabel: 'Mês',
};

export const Chart: Story = { render: () => <MonthlySeriesChart {...chartProps} /> };
export const ChartMobileCompactAxis: Story = {
  render: () => (
    <div className="w-[390px]">
      <MonthlySeriesChart {...chartProps} compactAxis />
    </div>
  ),
};
export const ChartLoading: Story = {
  render: () => (
    <MonthlySeriesChart {...chartProps} loading loadingLabel="Carregando dados do bairro…" />
  ),
};
export const ChartError: Story = {
  render: () => (
    <MonthlySeriesChart
      {...chartProps}
      error={{
        title: 'Não conseguimos carregar o gráfico',
        description: 'Os números do bairro continuam valendo. Tente de novo em instantes.',
      }}
      retry={{ label: 'Tentar de novo', href: '#' }}
    />
  ),
};

export const AreaBands: Story = {
  render: () => (
    <AreaBandTable
      caption="Quanto custa um apartamento na Vila Mariana por tamanho?"
      showCaption
      labels={{
        band: 'Área',
        sales: 'Vendas',
        median: 'Mediana',
        priceM2: priceM2Header,
        fewSales: 'poucas vendas',
      }}
      rows={[
        {
          key: 'a',
          label: 'Até 50 m²',
          sales: '612',
          medianValue: 'R$ 395 mil',
          medianPriceM2: 'R$ 8.020',
        },
        {
          key: 'b',
          label: '50–80 m²',
          sales: '701',
          medianValue: 'R$ 640 mil',
          medianPriceM2: 'R$ 7.110',
        },
        {
          key: 'c',
          label: '80–120 m²',
          sales: '498',
          medianValue: 'R$ 905 mil',
          medianPriceM2: 'R$ 6.650',
        },
        { key: 'd', label: 'Mais de 120 m²', sales: '8', medianValue: null, medianPriceM2: null },
      ]}
    />
  ),
};

const neighborLabels = {
  neighborhood: 'Bairro',
  priceM2: priceM2Header,
  change: '12 meses',
  current: '(este bairro)',
  fewSales: 'poucas vendas',
};
export const NeighborComparison: Story = {
  render: () => (
    <NeighborComparisonTable
      caption="A Vila Mariana é mais cara que os bairros vizinhos?"
      showCaption
      labels={neighborLabels}
      rows={[
        { key: 'moema', name: 'Moema', href: '#', priceM2: 'R$ 9.870', change: '+3,2%' },
        { key: 'vm', name: 'Vila Mariana', priceM2: 'R$ 6.940', change: '+1,8%', current: true },
        { key: 'acl', name: 'Aclimação', href: '#', priceM2: 'R$ 6.210', change: '−1,1%' },
        { key: 'sau', name: 'Saúde', href: '#', priceM2: null, change: null },
      ]}
    />
  ),
};

export const Zones: Story = {
  render: () => (
    <ZoneFilter
      label="Filtrar por zona"
      options={['Todas', 'Centro', 'Sul', 'Oeste', 'Norte', 'Leste'].map((z, i) => ({
        key: z,
        label: z,
        href: i ? `?zona=${z.toLowerCase()}` : '?',
        selected: z === 'Sul',
      }))}
    />
  ),
};
export const ZonesMobile: Story = {
  render: () => (
    <div className="w-[390px] px-4">
      <ZoneFilter
        label="Filtrar por zona"
        options={['Todas', 'Centro', 'Sul', 'Oeste', 'Norte', 'Leste'].map((z, i) => ({
          key: z,
          label: z,
          href: '#',
          selected: i === 0,
        }))}
      />
    </div>
  ),
};

// --- 03 Building ----------------------------------------------------------------------------

export const FactsComplete: Story = {
  render: () => (
    <BuildingFactsRow
      label="Dados do prédio"
      facts={[
        { key: 'year', text: 'construído em 1998' },
        { key: 'floors', text: '14 andares' },
        { key: 'units', text: '56 apartamentos' },
        { key: 'standard', text: 'padrão médio' },
      ]}
    />
  ),
};
export const FactsYearOnly: Story = {
  render: () => (
    <BuildingFactsRow
      label="Dados do prédio"
      facts={[{ key: 'year', text: 'construído em 1979' }, null, null]}
    />
  ),
};

export const SalesPerYear: Story = {
  render: () => (
    <SalesPerYearBars
      title="Vendas por ano"
      formatCount={(n) => `${n} vendas`}
      partialNote="*2026 até agosto"
      bars={[
        { year: '2019', count: 2 },
        { year: '2020', count: 3 },
        { year: '2021', count: 4 },
        { year: '2022', count: 2 },
        { year: '2023', count: 3 },
        { year: '2024', count: 3 },
        { year: '2025', count: 2 },
        { year: '2026', count: 2, partial: true },
      ]}
    />
  ),
};

export const Owner: Story = {
  render: () => (
    <OwnerCTA
      title="Você mora neste prédio?"
      description="Saiba quanto vale o seu apartamento com base em vendas reais do bairro."
      actions={[
        { key: 'value', label: 'Quanto vale o meu', href: '#' },
        { key: 'sell', label: 'Quero vender ou alugar', href: '#' },
      ]}
    />
  ),
};

export const OtherBuildings: Story = {
  render: () => (
    <BuildingList
      label="Outros prédios na Rua Joaquim Távora"
      footer="Mostrando 3 de 38"
      items={[
        {
          key: '1',
          name: 'Edifício Maison Blanche',
          href: '#',
          meta: '1998 · 56 apartamentos',
          aside: '21 vendas',
        },
        {
          key: '2',
          name: 'Edifício nº 1.410',
          href: '#',
          meta: '1979 · 32 apartamentos',
          aside: '4 vendas',
        },
        {
          key: '3',
          name: 'Condomínio Jardim Exemplo',
          href: '#',
          meta: '2012',
          aside: '14 vendas',
        },
      ]}
    />
  ),
};

// --- 05 Financing ---------------------------------------------------------------------------

const resultBase = {
  title: 'Renda familiar mínima indicada',
  badge: simulation,
  perMonth: '/mês',
  rate: 'Taxa ilustrativa de 11,5% a.a.',
  footnote: 'Seguros e tarifas não incluídos. Simulação, não é aprovação de crédito.',
};
export const IncomeSac: Story = {
  render: () => (
    <IncomeNeededResult
      {...resultBase}
      value="R$ 23.780"
      summary="parcela de até 30% da renda · financiamento de R$ 600.000"
      installments={{
        system: 'sac',
        first: { label: 'Primeira parcela', value: 'R$ 7.134' },
        last: { label: 'Última parcela', value: 'R$ 1.682' },
      }}
      totalInterest={{ label: 'Juros no prazo total', value: 'R$ 987 mil' }}
    />
  ),
};
export const IncomePrice: Story = {
  render: () => (
    <IncomeNeededResult
      {...resultBase}
      value="R$ 18.948"
      summary="parcela de até 30% da renda · financiamento de R$ 600.000"
      installments={{ system: 'price', fixed: { label: 'Parcela fixa', value: 'R$ 5.684' } }}
      totalInterest={{ label: 'Juros no prazo total', value: 'R$ 1,45 mi' }}
    />
  ),
};
export const IncomeDownPaymentTooLow: Story = {
  render: () => (
    <IncomeNeededResult
      {...resultBase}
      title="Renda mínima indicada"
      value={null}
      installments={{
        system: 'sac',
        first: { label: '', value: '' },
        last: { label: '', value: '' },
      }}
      invalidMessage="Ajuste a entrada para ver o resultado."
    />
  ),
};
export const NeighborIncome: Story = {
  render: () => (
    <NeighborIncomeTable
      caption="E em bairros vizinhos?"
      showCaption
      badge={simulation}
      labels={{
        neighborhood: 'Bairro',
        medianValue: 'Preço mediano',
        income: 'Renda indicada',
        current: '(este bairro)',
        fewSales: 'poucas vendas',
      }}
      rows={[
        {
          key: 'vm',
          name: 'Vila Mariana',
          medianValue: 'R$ 750 mil',
          income: 'R$ 23.780',
          current: true,
        },
        { key: 'moema', name: 'Moema', href: '#', medianValue: 'R$ 1,12 mi', income: 'R$ 35.510' },
        { key: 'sau', name: 'Saúde', href: '#', medianValue: 'R$ 479 mil', income: 'R$ 15.190' },
      ]}
    />
  ),
};
export const StickyBar: Story = {
  render: () => (
    <div className="relative h-40 w-[390px] overflow-hidden border border-line">
      <StickyResultBar
        className="absolute"
        label="Renda indicada · simulação"
        value="R$ 23.780"
        suffix="/mês"
        secondary={{ label: '1ª parcela', value: 'R$ 7.134' }}
        action={{ label: 'Ver detalhes', href: '#' }}
      />
    </div>
  ),
};

// --- 06 Street ------------------------------------------------------------------------------

export const QuickLinksWithListings: Story = {
  render: () => (
    <StreetQuickLinks
      label="Atalhos da rua"
      links={[
        {
          key: 'sale',
          title: 'Apartamentos à venda',
          href: '#',
          count: 4,
          caption: 'anúncios com CRECI',
        },
        { key: 'rent', title: 'Para alugar', href: '#', count: 7, caption: 'anúncios com CRECI' },
        { key: 'value', title: 'Quanto vale o meu', href: '#', caption: 'Estimativa grátis' },
      ]}
    />
  ),
};
export const QuickLinksNoListings: Story = {
  render: () => (
    <StreetQuickLinks
      label="Atalhos da rua"
      links={[
        {
          key: 'sale',
          title: 'Apartamentos à venda',
          href: '#',
          caption: 'Avise-me quando houver',
        },
        { key: 'rent', title: 'Para alugar', href: '#', caption: 'Avise-me quando houver' },
        { key: 'value', title: 'Quanto vale o meu', href: '#', caption: 'Estimativa grátis' },
      ]}
    />
  ),
};
export const StockBuildings: Story = {
  render: () => (
    <StockBlock
      title="Que imóveis existem nesta rua?"
      tiles={[
        { key: 'apts', label: 'Apartamentos', value: '1.240', caption: 'em 38 prédios' },
        { key: 'houses', label: 'Casas', value: '12' },
        { key: 'year', label: 'Construção mediana', value: '1994', caption: 'entre 1980 e 2005' },
        { key: 'size', label: 'Tamanho típico', value: '78 m²', caption: 'área construída (IPTU)' },
      ]}
      standardMix={{
        label: 'Padrão de construção (IPTU)',
        segments: [
          { key: 'simple', label: 'Simples', share: 0.18, display: '18%' },
          { key: 'medium', label: 'Médio', share: 0.62, display: '62%' },
          { key: 'high', label: 'Alto', share: 0.2, display: '20%' },
        ],
      }}
    />
  ),
};
export const StockHousesOnly: Story = {
  render: () => (
    <StockBlock
      variant="houses"
      title="Que imóveis existem nesta rua?"
      tiles={[
        { key: 'houses', label: 'Casas', value: '86', caption: 'nenhum prédio residencial' },
        { key: 'lot', label: 'Terreno típico', value: '250 m²', caption: 'mediana do cadastro' },
        { key: 'year', label: 'Construção mediana', value: '1968', caption: 'ano' },
        { key: 'size', label: 'Área construída típica', value: '180 m²' },
      ]}
    />
  ),
};
export const Turnover: Story = {
  render: () => (
    <TurnoverLine
      value="15%"
      text="das unidades desta rua foram vendidas nos últimos 3 anos."
      comparison="Na Vila Mariana, 12%."
    />
  ),
};
export const Buildings: Story = {
  render: () => (
    <BuildingTable
      caption="Prédios na Rua Joaquim Távora"
      showCaption
      footer={<a href="#">Mostrando 3 de 38 · Ver todos</a>}
      labels={{
        building: 'Prédio',
        year: 'Construído',
        floors: 'Andares',
        units: 'Apartamentos',
        sales: 'Vendas desde 2019',
      }}
      rows={[
        {
          key: '1',
          name: 'Edifício Maison Blanche',
          href: '#',
          year: '1998',
          floors: '14',
          units: '56',
          sales: '21',
        },
        {
          key: '2',
          name: 'Edifício nº 1.410',
          href: '#',
          year: '1979',
          floors: '8',
          units: '32',
          sales: '4',
        },
        {
          key: '3',
          name: 'Condomínio Jardim Exemplo',
          href: '#',
          year: '2012',
          floors: null,
          units: null,
          sales: '14',
        },
      ]}
    />
  ),
};
export const Segments: Story = {
  render: () => (
    <SegmentTable
      caption="Trechos da Rua Vergueiro"
      showCaption
      labels={{
        segment: 'Trecho',
        buildings: 'Prédios',
        units: 'Apts',
        sales: 'Vendas',
        current: '(trecho atual)',
      }}
      rows={[
        { key: 'lib', name: 'Liberdade', href: '#', buildings: '41', units: '2.870', sales: '228' },
        { key: 'par', name: 'Paraíso', href: '#', buildings: '37', units: '2.410', sales: '201' },
        {
          key: 'vm',
          name: 'Vila Mariana',
          buildings: '58',
          units: '3.980',
          sales: '394',
          current: true,
        },
        { key: 'ipi', name: 'Ipiranga', href: '#', buildings: '12', units: '760', sales: '41' },
      ]}
    />
  ),
};
