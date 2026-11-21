import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddressAutocomplete, type AddressSuggestion } from './AddressAutocomplete.tsx';
import { ComparableGroupList } from './ComparableGroupList.tsx';
import { FilterBar } from './FilterBar.tsx';
import { LeadAlertForm, type LeadAlertFormLabels } from './LeadAlertForm.tsx';
import { PropertyCard } from './PropertyCard.tsx';
import { ValueRangeResult } from './ValueRangeResult.tsx';

const SUGGESTIONS: AddressSuggestion[] = [
  { id: '1', label: 'Rua Exemplo, 1240', detail: 'Vila Mariana' },
  { id: '2', label: 'Rua Exemplo, 124', detail: 'Vila Mariana' },
  { id: '3', label: 'Rua Exemplo, 12', detail: 'Vila Mariana' },
  { id: '4', label: 'Rua Exemplo, 1', detail: 'Vila Mariana' },
];

function Combobox({ onSelect }: { onSelect: (s: AddressSuggestion) => void }) {
  const [value, setValue] = useState('');
  return (
    <AddressAutocomplete
      value={value}
      status="suggestions"
      suggestions={SUGGESTIONS}
      onQueryChange={setValue}
      onSelect={(s) => {
        setValue(s.label);
        onSelect(s);
      }}
      labels={{
        label: 'Endereço do imóvel',
        coverage: 'Endereços de São Paulo · cobertura: capital',
        loading: 'Procurando…',
        notFound: 'Não achamos esse endereço',
        outsideCoverage: 'Ainda não cobrimos este endereço',
      }}
    />
  );
}

describe('AddressAutocomplete', () => {
  it('shows at most 3 options and selects with the keyboard', async () => {
    const onSelect = vi.fn();
    render(<Combobox onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Endereço do imóvel' });
    await userEvent.type(input, 'Rua Ex');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const second = screen.getAllByRole('option')[1]!;
    expect(input).toHaveAttribute('aria-activedescendant', second.id);
    expect(second).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(SUGGESTIONS[1]);
    expect(input).toHaveValue('Rua Exemplo, 124');
  });

  it('closes on Escape and shows the coverage note', async () => {
    render(<Combobox onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'Rua');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Endereços de São Paulo · cobertura: capital')).toBeInTheDocument();
  });
});

describe('ValueRangeResult', () => {
  const base = {
    title: 'Estimativa de valor de venda',
    range: 'R$ 1,05–1,55 mi',
    confidenceLabel: 'Confiança',
    lowConfidenceNote: 'Poucas vendas parecidas por perto. Use como referência inicial.',
  };

  it('shows the yellow note only for low confidence', () => {
    const { rerender } = render(<ValueRangeResult {...base} state="baixa" />);
    expect(screen.getByText(base.lowConfidenceNote)).toBeInTheDocument();
    rerender(<ValueRangeResult {...base} state="alta" />);
    expect(screen.queryByText(base.lowConfidenceNote)).not.toBeInTheDocument();
  });

  it('shows a status while loading, without numbers', () => {
    render(<ValueRangeResult {...base} state="loading" loadingLabel="Procurando vendas…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Procurando vendas…');
    expect(screen.queryByText(base.range)).not.toBeInTheDocument();
  });
});

describe('ComparableGroupList', () => {
  it('shows only the count for a group below the threshold', () => {
    render(
      <ComparableGroupList
        title="Como chegamos neste valor"
        fewSalesLabel="poucas vendas"
        groups={[
          {
            key: 'a',
            description: 'Grupo grande',
            sales: '62 vendas',
            median: 'mediana R$ 775 mil',
          },
          { key: 'b', description: 'Grupo pequeno', sales: '4 vendas', median: null },
        ]}
      />,
    );
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('mediana R$ 775 mil')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('4 vendas')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('poucas vendas')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText(/R\$/)).not.toBeInTheDocument();
  });
});

describe('FilterBar', () => {
  it('removes a chip and clears all', async () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    render(
      <FilterBar
        controls={null}
        active={[{ key: 'q', label: '2+ quartos', removeLabel: 'Remover 2+ quartos' }]}
        onRemove={onRemove}
        clearLabel="Limpar filtros"
        onClear={onClear}
        filtersLabel="Filtros"
        onOpenSheet={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remover 2+ quartos' }));
    expect(onRemove).toHaveBeenCalledWith('q');
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('PropertyCard', () => {
  it('renders rental cost lines and the total', () => {
    render(
      <PropertyCard
        title="Apartamento para alugar · Vila Mariana"
        price="R$ 3.800/mês"
        costLines={[
          { key: 'c', label: '+ cond. R$ 980' },
          { key: 'i', label: '+ IPTU R$ 160' },
        ]}
        costTotal="Total R$ 4.940/mês"
        specs="2 qts · 68 m²"
        broker="Corretora · CRECI-SP 000.000-F"
      />,
    );
    expect(screen.getByText('+ cond. R$ 980')).toBeInTheDocument();
    expect(screen.getByText('Total R$ 4.940/mês')).toBeInTheDocument();
    expect(screen.getByText('Corretora · CRECI-SP 000.000-F')).toBeInTheDocument();
  });
});

const LABELS: LeadAlertFormLabels = {
  title: 'Quer ver imóveis no seu orçamento?',
  name: 'Nome',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  emailOptional: '(opcional)',
  intentLabel: 'O que você quer?',
  consentContact: 'Aceito ser contatado sobre imóveis',
  consentMarketing: 'Novidades (opcional)',
  consentRequired: 'Marque para continuar',
  honeypot: 'Não preencha',
  submit: 'Enviar',
  submitting: 'Enviando…',
  successTitle: 'Pedido registrado',
  successDescription: 'Guardamos seu pedido.',
  errorTitle: 'Erro',
  privacyLine: 'Usamos seus dados só para este contato, conforme a LGPD.',
};

describe('LeadAlertForm (SEO-3 options)', () => {
  it('uses custom intents (default first), chips and the extra currency field', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <LeadAlertForm
        labels={LABELS}
        intents={[
          { value: 'rent', label: 'Quero alugar' },
          { value: 'buy', label: 'Quero comprar' },
        ]}
        chips={[<span key="a">Aluguel</span>]}
        extraField={{ name: 'budget', label: 'Orçamento', kind: 'currency' }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
    expect(screen.getByText(LABELS.privacyLine as string)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nome'), 'Pessoa');
    await userEvent.type(screen.getByRole('textbox', { name: 'WhatsApp' }), '11900000000');
    await userEvent.type(screen.getByLabelText('Orçamento'), '500000');
    await userEvent.click(screen.getByRole('checkbox', { name: LABELS.consentContact }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0]![0];
    expect(values.intent).toBe('rent');
    expect(typeof values.extra).toBe('number');
    expect(values.extra).toBeGreaterThan(0);
  });

  it('keeps the SEO-1 defaults (buy / owner) without intents', () => {
    render(
      <LeadAlertForm
        labels={{ ...LABELS, intentBuy: 'Comprar aqui', intentOwner: 'Tenho imóvel aqui' }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Comprar aqui' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tenho imóvel aqui' })).toBeInTheDocument();
  });
});
