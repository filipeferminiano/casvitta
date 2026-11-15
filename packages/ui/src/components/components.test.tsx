import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { Checkbox } from './Checkbox.tsx';
import { CurrencyInput, parseCentsInput } from './CurrencyInput.tsx';
import { DataTable } from './DataTable.tsx';
import { IconButton } from './IconButton.tsx';
import { Input } from './Input.tsx';
import { Logo } from './Logo.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { EmptyState, ErrorState, LoadingState } from './States.tsx';
import { Switch } from './Switch.tsx';

describe('Button', () => {
  it('is a real button, type=button by default', () => {
    render(<Button>Publicar anúncio</Button>);
    const button = screen.getByRole('button', { name: 'Publicar anúncio' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('shows the loading label, is busy and cannot be clicked', async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Publicando…" onClick={onClick}>
        Publicar anúncio
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Publicando…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a link with button styles via asChild', () => {
    render(
      <Button asChild>
        <a href="/leads">Ver leads</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Ver leads' })).toHaveClass('bg-action');
  });
});

describe('IconButton', () => {
  it('uses the label as accessible name', () => {
    render(<IconButton label="Mais ações" icon={<svg />} />);
    expect(screen.getByRole('button', { name: 'Mais ações' })).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('links label, help and error to the input', () => {
    render(
      <Input label="CRECI" help="Como está na sua carteira." error="Use o formato 000.000-F." />,
    );
    const input = screen.getByLabelText('CRECI');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Use o formato 000.000-F. Como está na sua carteira.',
    );
  });
});

describe('CurrencyInput', () => {
  it('parses digits as cents', () => {
    expect(parseCentsInput('6.563,40')).toBe(656_340);
    expect(parseCentsInput('R$ 0,05')).toBe(5);
    expect(parseCentsInput('')).toBeNull();
  });

  it('fills from the right like a cash register and reports integer cents', async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <CurrencyInput
          label="Orçamento por dia"
          value={value}
          onValueChange={(cents) => {
            setValue(cents);
            onChange(cents);
          }}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText('Orçamento por dia');
    await userEvent.type(input, '2500');
    expect(input).toHaveValue('25,00');
    expect(onChange).toHaveBeenLastCalledWith(2_500);
    await userEvent.type(input, '{Backspace}');
    expect(input).toHaveValue('2,50');
  });
});

describe('Checkbox and Switch', () => {
  it('toggles a checkbox through its label', async () => {
    render(<Checkbox label="Aceita FGTS" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Aceita FGTS' });
    await userEvent.click(screen.getByText('Aceita FGTS'));
    expect(checkbox).toBeChecked();
  });

  it('toggles a switch with the keyboard', async () => {
    render(<Switch label="Página do imóvel" description="Endereço próprio." />);
    const toggle = screen.getByRole('switch', { name: 'Página do imóvel' });
    expect(toggle).toHaveAccessibleDescription('Endereço próprio.');
    toggle.focus();
    await userEvent.keyboard(' ');
    expect(toggle).toBeChecked();
  });
});

describe('SegmentedControl', () => {
  it('never deselects the current option', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Período"
        value="week"
        onValueChange={onChange}
        options={[
          { value: 'day', label: 'Dia' },
          { value: 'week', label: 'Semana' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Semana' }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: 'Dia' }));
    expect(onChange).toHaveBeenCalledWith('day');
  });
});

describe('Badge', () => {
  it('marks AI content with the icon and given text', () => {
    render(<Badge variant="ai">Feito por IA</Badge>);
    const badge = screen.getByText('Feito por IA');
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('DataTable', () => {
  const columns = [
    {
      key: 'name',
      header: 'Canal',
      cell: (r: { name: string; n: number }) => r.name,
      total: 'Total',
    },
    {
      key: 'n',
      header: 'Leads',
      numeric: true,
      cell: (r: { name: string; n: number }) => r.n,
      total: 3,
    },
  ];

  it('renders headers, numeric cells right-aligned and a totals row', () => {
    render(
      <DataTable
        caption="Leads por canal"
        columns={columns}
        rows={[{ name: 'Google', n: 3 }]}
        rowKey={(r) => r.name}
        showTotals
      />,
    );
    const table = screen.getByRole('table', { name: 'Leads por canal' });
    expect(within(table).getByRole('columnheader', { name: 'Leads' })).toHaveClass('text-right');
    expect(within(table).getAllByText('3')[0]).toHaveClass('font-mono');
    expect(within(table).getByText('Total').closest('tr')).toHaveClass('border-t-2');
  });

  it('renders the empty state when there are no rows', () => {
    render(
      <DataTable
        caption="Leads por canal"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.name}
        empty={<EmptyState title="Nenhum lead ainda" />}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nenhum lead ainda' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('States', () => {
  it('announces loading politely', () => {
    render(<LoadingState title="Carregando seus leads" description="Leva alguns segundos." />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando seus leads');
  });

  it('error state says what failed, what still works and how to fix', () => {
    render(
      <ErrorState
        title="A Meta recusou o anúncio."
        stillWorks="O marketplace e o Google seguem no ar."
        howToFix="Troque a foto 3."
        primaryAction={<Button>Trocar foto</Button>}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('A Meta recusou o anúncio.');
    expect(alert).toHaveTextContent('O marketplace e o Google seguem no ar.');
    expect(within(alert).getByRole('button', { name: 'Trocar foto' })).toBeInTheDocument();
  });
});

describe('Logo', () => {
  it('has an accessible name by default and can be decorative', () => {
    const { rerender } = render(<Logo />);
    expect(screen.getByRole('img', { name: 'Casvitta' })).toBeInTheDocument();
    rerender(<Logo title={null} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
