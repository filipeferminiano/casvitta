import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Checkbox } from './Checkbox.tsx';
import { CurrencyInput } from './CurrencyInput.tsx';
import { Input } from './Input.tsx';
import { Select } from './Select.tsx';
import { Switch } from './Switch.tsx';

const meta = { title: 'Foundations/Forms' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const InputStates: Story = {
  render: () => (
    <div className="grid max-w-md gap-6">
      <Input label="Nome completo" placeholder="Ana Ribeiro" />
      <Input
        label="E-mail"
        type="email"
        help="Enviamos o link de acesso para este e-mail."
        defaultValue="ana@exemplo.com.br"
      />
      <Input label="Bairro" hint="(opcional)" />
      <Input
        label="CRECI"
        defaultValue="000.000"
        error="Falta a letra no fim do número. Use o formato 000.000-F."
      />
      <Input label="Cidade" defaultValue="São Paulo" disabled />
    </div>
  ),
};

function CurrencyDemo({ initial, error }: { initial: number | null; error?: string }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <CurrencyInput
      label="Orçamento por dia"
      value={value}
      onValueChange={setValue}
      help="Mínimo de R$ 20 por dia. Você paga só o que for gasto."
      error={error}
    />
  );
}

export const CurrencyInputStates: Story = {
  render: () => (
    <div className="grid max-w-md gap-6">
      <CurrencyDemo initial={null} />
      <CurrencyDemo initial={2_500} />
      <CurrencyDemo
        initial={1_500}
        error="O mínimo é R$ 20 por dia. Aumente o valor para continuar."
      />
      <CurrencyInput label="Preço do imóvel" value={69_000_000} onValueChange={() => {}} disabled />
    </div>
  ),
};

const transactionOptions = [
  { value: 'sale', label: 'Venda' },
  { value: 'rent', label: 'Aluguel' },
  { value: 'both', label: 'Venda e aluguel', disabled: true },
];

export const SelectStates: Story = {
  render: () => (
    <div className="grid max-w-md gap-6">
      <Select
        label="Tipo de negócio"
        options={transactionOptions}
        placeholder="Escolha uma opção"
      />
      <Select label="Tipo de negócio" options={transactionOptions} defaultValue="sale" />
      <Select
        label="Tipo de negócio"
        options={transactionOptions}
        error="Escolha venda ou aluguel para publicar o imóvel."
        placeholder="Escolha uma opção"
      />
      <Select label="Tipo de negócio" options={transactionOptions} defaultValue="rent" disabled />
    </div>
  ),
};

export const CheckboxStates: Story = {
  render: () => (
    <div className="grid max-w-md gap-2">
      <Checkbox label="Aceita FGTS" />
      <Checkbox
        label="Exclusividade"
        description="O proprietário assinou exclusividade com você."
        defaultChecked
      />
      <Checkbox label="Selecionar todos" checked="indeterminate" />
      <Checkbox
        label="Tenho autorização do proprietário"
        error="Sem autorização não dá para publicar. Anexe o documento assinado."
      />
      <Checkbox label="Opção indisponível" disabled />
    </div>
  ),
};

export const SwitchStates: Story = {
  render: () => (
    <div className="grid max-w-md gap-2">
      <Switch
        label="Página do imóvel"
        description="Endereço próprio para compartilhar."
        aside="incluso"
        defaultChecked
      />
      <Switch
        label="Instagram e Facebook"
        description="Aparece no feed e nos stories."
        aside="do orçamento"
      />
      <Switch
        label="Google"
        description="Disponível no plano Profissional."
        aside="do orçamento"
        disabled
      />
    </div>
  ),
};
