import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MonthlySeriesChart } from './MonthlySeriesChart.tsx';
import {
  BuildingFactsRow,
  IncomeNeededResult,
  StickyResultBar,
  StockBlock,
  StreetQuickLinks,
  ZoneFilter,
} from './SeoBlocks.tsx';
import { AreaBandTable, NeighborComparisonTable } from './SeoTables.tsx';

describe('NeighborComparisonTable', () => {
  it('highlights the current neighborhood and links the others', () => {
    render(
      <NeighborComparisonTable
        caption="Vizinhos"
        labels={{
          neighborhood: 'Bairro',
          priceM2: 'R$/m²',
          change: '12 meses',
          current: '(este bairro)',
          fewSales: 'poucas vendas',
        }}
        rows={[
          { key: 'a', name: 'Moema', href: '/m', priceM2: 'R$ 9.870', change: '+3,2%' },
          { key: 'b', name: 'Vila Mariana', priceM2: 'R$ 6.940', change: '−1,8%', current: true },
        ]}
      />,
    );
    const rows = screen.getAllByRole('row');
    const current = rows.find((r) => r.getAttribute('data-current') === 'true');
    expect(current).toBeDefined();
    expect(within(current!).getByText('(este bairro)')).toBeInTheDocument();
    expect(within(current!).queryByRole('link')).toBeNull();
    expect(screen.getByRole('link', { name: 'Moema' })).toHaveAttribute('href', '/m');
    expect(screen.getByText('−1,8%')).toBeInTheDocument(); // sign as text
  });
});

describe('count-only variant', () => {
  it('shows "poucas vendas" instead of a price when the group is below the threshold', () => {
    render(
      <AreaBandTable
        caption="Por tamanho"
        labels={{
          band: 'Área',
          sales: 'Vendas',
          median: 'Mediana',
          priceM2: 'R$/m²',
          fewSales: 'poucas vendas',
        }}
        rows={[
          { key: 'x', label: 'Mais de 120 m²', sales: '8', medianValue: null, medianPriceM2: null },
        ]}
      />,
    );
    const row = screen.getByRole('row', { name: /Mais de 120 m²/ });
    expect(within(row).getByText('8')).toBeInTheDocument();
    expect(within(row).getAllByText('poucas vendas')).toHaveLength(2);
    expect(within(row).queryByText(/R\$/)).toBeNull();
  });
});

describe('ZoneFilter', () => {
  it('renders links (works without JS) and marks the selected zone', () => {
    render(
      <ZoneFilter
        label="Filtrar por zona"
        options={[
          { key: 'all', label: 'Todas', href: '/preco-m2/sao-paulo' },
          { key: 'sul', label: 'Sul', href: '/preco-m2/sao-paulo?zona=sul', selected: true },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Filtrar por zona' });
    expect(within(nav).getByRole('link', { name: 'Sul' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Todas' })).not.toHaveAttribute('aria-current');
  });
});

describe('IncomeNeededResult', () => {
  const base = {
    title: 'Renda familiar mínima indicada',
    badge: <span>Simulação · não é aprovação</span>,
    value: 'R$ 23.780',
  };

  it('SAC shows first and last installment', () => {
    render(
      <IncomeNeededResult
        {...base}
        installments={{
          system: 'sac',
          first: { label: 'Primeira parcela', value: 'R$ 7.134' },
          last: { label: 'Última parcela', value: 'R$ 1.682' },
        }}
        totalInterest={{ label: 'Juros no prazo total', value: 'R$ 987 mil' }}
      />,
    );
    expect(screen.getByText('Primeira parcela')).toBeInTheDocument();
    expect(screen.getByText('Última parcela')).toBeInTheDocument();
    expect(screen.queryByText('Parcela fixa')).toBeNull();
    expect(screen.getByText('Simulação · não é aprovação')).toBeInTheDocument();
  });

  it('Price shows only the fixed installment', () => {
    render(
      <IncomeNeededResult
        {...base}
        installments={{ system: 'price', fixed: { label: 'Parcela fixa', value: 'R$ 5.684' } }}
      />,
    );
    expect(screen.getByText('Parcela fixa')).toBeInTheDocument();
    expect(screen.queryByText('Última parcela')).toBeNull();
  });

  it('invalid inputs hide the numbers and show the message', () => {
    const { container } = render(
      <IncomeNeededResult
        {...base}
        value={null}
        installments={{ system: 'price', fixed: { label: 'Parcela fixa', value: 'R$ 5.684' } }}
        invalidMessage="Ajuste a entrada para ver o resultado."
      />,
    );
    expect(screen.getByText('R$ —')).toBeInTheDocument();
    expect(screen.getByText('Ajuste a entrada para ver o resultado.')).toBeInTheDocument();
    expect(screen.queryByText('R$ 5.684')).toBeNull();
    expect(container.querySelector('[data-invalid="true"]')).not.toBeNull();
  });
});

describe('StockBlock', () => {
  it('houses-only variant has no standard-mix bar', () => {
    render(
      <StockBlock
        variant="houses"
        title="Que imóveis existem nesta rua?"
        tiles={[{ key: 'h', label: 'Casas', value: '86' }]}
        standardMix={{
          label: 'Padrão de construção (IPTU)',
          segments: [{ key: 's', label: 'Simples', share: 1, display: '100%' }],
        }}
      />,
    );
    expect(screen.getByText('Casas')).toBeInTheDocument();
    expect(screen.queryByText('Padrão de construção (IPTU)')).toBeNull();
  });
});

describe('StreetQuickLinks', () => {
  it('shows a count only for real listings', () => {
    render(
      <StreetQuickLinks
        label="Atalhos"
        links={[
          { key: 'a', title: 'À venda', href: '#', count: 4, caption: 'anúncios com CRECI' },
          { key: 'b', title: 'Para alugar', href: '#', caption: 'Avise-me quando houver' },
        ]}
      />,
    );
    expect(screen.getAllByTestId('quick-link-count')).toHaveLength(1);
    expect(screen.getByText('Avise-me quando houver')).toBeInTheDocument();
  });
});

describe('StickyResultBar', () => {
  it('is a labelled region hidden from md up, with the action as a link', () => {
    render(
      <StickyResultBar
        label="Renda indicada · simulação"
        value="R$ 23.780"
        secondary={{ label: '1ª parcela', value: 'R$ 7.134' }}
        action={{ label: 'Ver detalhes', href: '#resultado' }}
      />,
    );
    const region = screen.getByRole('region', { name: 'Renda indicada · simulação' });
    expect(region.className).toContain('md:hidden');
    expect(within(region).getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute(
      'href',
      '#resultado',
    );
  });
});

describe('BuildingFactsRow', () => {
  it('drops missing facts', () => {
    render(
      <BuildingFactsRow
        label="Dados do prédio"
        facts={[{ key: 'y', text: 'construído em 1979' }, null]}
      />,
    );
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('MonthlySeriesChart states', () => {
  const props = {
    points: [
      { month: '2025-01', value: 100, count: 3 },
      { month: '2025-02', value: 110, count: 4 },
      { month: '2025-03', value: 120, count: 5 },
    ],
    formatValue: (v: number) => `R$ ${v}`,
    formatMonth: (m: string) => `m${m}`,
    title: 'Série',
    countLabel: 'Vendas',
    valueLabel: 'Mediana',
    monthLabel: 'Mês',
  };

  it('compact axis labels only the first and last month', () => {
    const { container } = render(<MonthlySeriesChart {...props} compactAxis />);
    const labels = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(labels).toContain('m2025-01');
    expect(labels).toContain('m2025-03');
    expect(labels).not.toContain('m2025-02');
  });

  it('error keeps a retry link and no chart', () => {
    const { container } = render(
      <MonthlySeriesChart
        {...props}
        error={{ title: 'Não conseguimos carregar o gráfico' }}
        retry={{ label: 'Tentar de novo', href: '?retry=1' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos carregar o gráfico');
    expect(screen.getByRole('link', { name: 'Tentar de novo' })).toHaveAttribute(
      'href',
      '?retry=1',
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('loading announces the status', () => {
    render(<MonthlySeriesChart {...props} loading loadingLabel="Carregando dados do bairro…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando dados do bairro…');
  });
});
