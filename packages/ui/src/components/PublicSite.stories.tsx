import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AudienceCard } from './AudienceCard.tsx';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { Callout } from './Callout.tsx';
import { Chip, filterChipClass } from './Chip.tsx';
import { ChoiceChips } from './ChoiceChips.tsx';
import { EstimateBox } from './EstimateBox.tsx';
import { MapPins } from './MapPins.tsx';
import { NumberedSteps } from './NumberedSteps.tsx';
import { PlanCard } from './PlanCard.tsx';
import { PropertyCard } from './PropertyCard.tsx';

const meta = { title: 'Domain/Public site' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Callouts: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <Callout>Conferimos o número na consulta pública do conselho regional.</Callout>
      <Callout tone="attention" title="Amostra pequena">
        3 visitas em 7 dias. Trate como hipótese.
      </Callout>
      <Callout tone="risk" title="Antes de dar um lance">
        <ul className="list-disc pl-4">
          <li>O imóvel pode estar ocupado.</li>
          <li>Nem todo leilão aceita financiamento ou FGTS.</li>
        </ul>
      </Callout>
    </div>
  ),
};

const steps = [
  {
    key: '1',
    title: 'Busque do seu jeito',
    description: 'Por bairro, perto do metrô ou por quem aceita FGTS.',
  },
  {
    key: '2',
    title: 'Tire dúvidas a qualquer hora',
    description: 'O assistente responde com base na ficha.',
  },
  { key: '3', title: 'Visite com quem é credenciado', description: 'Todo anúncio mostra o CRECI.' },
];

export const Steps: Story = {
  render: () => (
    <div className="flex max-w-4xl flex-col gap-8">
      <NumberedSteps steps={steps} />
      <NumberedSteps steps={steps} variant="list" />
    </div>
  ),
};

export const Plans: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-4">
      <PlanCard
        name="Essencial"
        price="R$ 197"
        period="/mês"
        features={[
          'Até 3 imóveis',
          'Sua landing page + uma por imóvel',
          'Assistente de IA no WhatsApp',
        ]}
        action={<Button variant="secondary">Escolher Essencial</Button>}
      />
      <PlanCard
        highlighted
        name="Profissional"
        price="R$ 397"
        period="/mês"
        features={['Até 15 imóveis', 'Tudo do Essencial', 'Relatório semanal por canal']}
        action={<Button>Escolher Profissional</Button>}
      />
    </div>
  ),
};

export const Audiences: Story = {
  render: () => (
    <div className="grid max-w-4xl grid-cols-2 gap-4 bg-fg p-6">
      <AudienceCard
        title="Proprietário"
        description="Um corretor credenciado cuida do anúncio."
        action={<a href="#a">Anunciar meu imóvel ›</a>}
      />
      <AudienceCard
        title="Incorporadora"
        soon={<Badge variant="soon">Em breve</Badge>}
        description="Distribua lançamentos para corretores e compradores."
        action={<a href="#b">Entrar na lista de espera ›</a>}
      />
    </div>
  ),
};

function ChoicesDemo() {
  const [kinds, setKinds] = useState(['apartment']);
  const [payment, setPayment] = useState<string[]>([]);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <ChoiceChips
        label="Tipo de imóvel"
        name="kinds"
        multiple
        value={kinds}
        onChange={setKinds}
        options={[
          { value: 'apartment', label: 'Apartamento' },
          { value: 'house', label: 'Casa' },
          { value: 'land', label: 'Terreno' },
        ]}
      />
      <ChoiceChips
        label="Como pretende pagar"
        name="payment"
        value={payment}
        onChange={setPayment}
        error={payment.length ? undefined : 'Escolha uma forma de pagamento.'}
        options={[
          { value: 'cash', label: 'À vista' },
          { value: 'financing', label: 'Financiamento' },
        ]}
      />
    </div>
  );
}

export const Choices: Story = { render: () => <ChoicesDemo /> };

export const FilterChips: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <a href="#x" className={filterChipClass(true)}>
        Vila Mariana ×
      </a>
      <a href="#y" className={filterChipClass(false)}>
        Mais filtros
      </a>
      <Chip onRemove={() => {}} removeLabel="Remover FGTS">
        Aceita FGTS
      </Chip>
    </div>
  ),
};

export const ResultCardWithEstimate: Story = {
  render: () => (
    <PropertyCard
      layout="horizontal"
      className="max-w-2xl"
      photoCaption="Foto"
      badges={<Badge variant="sponsored">Destaque pago</Badge>}
      kicker="Apartamento à venda"
      title="Rua Domingos de Morais · Vila Mariana"
      price="R$ 690.000"
      specs="2 quartos · 68 m² · 1 vaga"
      extra={
        <EstimateBox
          badge={<Badge variant="simulation">Estimativa · não é garantia</Badge>}
          basis="Base: 9 aluguéis parecidos no bairro"
          rows={[
            { key: 'rent', label: 'Aluguel estimado', value: 'R$ 3.900/mês' },
            { key: 'yield', label: 'Rentabilidade bruta', value: '6,8% a.a.' },
          ]}
        />
      }
      broker={
        <>
          Ana Ribeiro <Badge variant="creci">CRECI-SP 000.000-F</Badge>
        </>
      }
    />
  ),
};

export const Map: Story = {
  render: () => (
    <MapPins
      className="h-96 max-w-xl"
      label="Mapa · Vila Mariana"
      caption="Mapa · Vila Mariana"
      pins={[
        { id: '1', lat: -23.5893, lng: -46.6345, label: '690 mil', highlighted: true },
        { id: '2', lat: -23.5842, lng: -46.6371, label: '710 mil' },
        { id: '3', lat: -23.5905, lng: -46.6402, label: '655 mil' },
      ]}
    />
  ),
};
