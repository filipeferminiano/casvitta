import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { formatBRL } from '../lib/format.ts';
import { Badge } from './Badge.tsx';
import { BudgetPicker, ChannelToggle } from './BudgetPicker.tsx';
import { Chip } from './Chip.tsx';
import { BrowserFrame, PhoneFrame } from './Frames.tsx';
import { PhotoPlaceholder } from './PhotoPlaceholder.tsx';
import { PropertyCard } from './PropertyCard.tsx';
import { PropertyRow } from './PropertyRow.tsx';
import { Stepper } from './Stepper.tsx';

const meta = { title: 'Domain/Ads and listings' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const steps = [
  { key: 'property', label: 'Imóvel' },
  { key: 'ad', label: 'Anúncio' },
  { key: 'publish', label: 'Publicar' },
];

export const Steppers: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Stepper label="Etapas" doneLabel="concluído" steps={steps} current="property" />
      <Stepper label="Etapas" doneLabel="concluído" steps={steps} current="ad" />
      <Stepper label="Etapas" doneLabel="concluído" steps={steps} current="publish" />
    </div>
  ),
};

function BudgetDemo({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);
  return (
    <BudgetPicker
      className="max-w-xl"
      label="Quanto investir por dia"
      value={value}
      onChange={setValue}
      suggestions={[2_000, 3_000, 5_000]}
      recommended={3_000}
      minimum={2_000}
      format={(c) => formatBRL(c)}
      copy={{
        perDay: 'por dia',
        recommended: 'recomendado',
        other: 'Outro valor por dia',
        otherHelp: 'Mínimo de R$ 20 por dia.',
        belowMinimum: 'O mínimo é R$ 20 por dia. Aumente o valor para publicar.',
      }}
      explanation="Por que R$ 30: imóveis parecidos receberam entre 8 e 14 pedidos de contato em 7 dias. É uma faixa observada, não uma promessa."
    />
  );
}

export const Budget: Story = { render: () => <BudgetDemo initial={3_000} /> };
export const BudgetCustomAmount: Story = { render: () => <BudgetDemo initial={4_500} /> };
export const BudgetBelowMinimum: Story = { render: () => <BudgetDemo initial={1_500} /> };

function ChannelsDemo() {
  const [on, setOn] = useState({ landing: true, meta: false });
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <ChannelToggle
        name="Página do imóvel"
        description="Landing page própria"
        costNote="incluso"
        checked={on.landing}
        onCheckedChange={(v) => setOn((s) => ({ ...s, landing: v }))}
      />
      <ChannelToggle
        name="Instagram e Facebook"
        description="Pessoas da região com perfil de comprador"
        costNote="do orçamento"
        checked={on.meta}
        onCheckedChange={(v) => setOn((s) => ({ ...s, meta: v }))}
      />
      <ChannelToggle
        name="Google"
        description="Disponível no plano Profissional"
        costNote="do orçamento"
        checked={false}
        onCheckedChange={() => {}}
        disabled
      />
    </div>
  );
}

export const Channels: Story = { render: () => <ChannelsDemo /> };

export const PropertyRows: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-3">
      <PropertyRow
        selected
        photoCaption="Foto do imóvel"
        title="Apartamento · Rua Domingos de Morais"
        details="Vila Mariana · 2 quartos · 68 m² · 1 vaga · 9 fotos"
        price="R$ 690.000"
        status={<Chip tone="success">Autorização de venda assinada · 02/11</Chip>}
      />
      <PropertyRow
        disabled
        photoCaption="Foto do imóvel"
        title="Apartamento · Rua Cardoso de Almeida"
        details="Perdizes · 3 quartos · 96 m² · 11 fotos"
        price="R$ 980.000"
        status={<Chip tone="danger">Sem autorização de venda: não pode ser anunciado</Chip>}
      />
    </div>
  ),
};

export const PropertyCards: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-4">
      <PropertyCard
        photoCaption="Foto 1 · sala com varanda"
        badges={
          <>
            <Badge variant="sponsored">Destaque pago</Badge>
            <Badge variant="demo">Demonstrativo</Badge>
          </>
        }
        title="Apartamento · Vila Mariana"
        price="R$ 690.000"
        specs="2 quartos · 68 m² · 1 vaga"
        broker={
          <>
            <span>Ana Ribeiro</span>
            <Badge variant="creci">CRECI-SP 000.000-F</Badge>
          </>
        }
      />
      <PropertyCard
        title="Casa · Saúde"
        price="R$ 1.150.000"
        specs="3 quartos · 140 m² · 2 vagas"
        broker={
          <>
            <span>Ana Ribeiro</span>
            <Badge variant="creci">CRECI-SP 000.000-F</Badge>
          </>
        }
      />
    </div>
  ),
};

export const Frames: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <BrowserFrame url="anaribeiro.casvitta.com.br/apto-vila-mariana" className="w-[420px]">
        <PhotoPlaceholder caption="Foto principal" className="h-48 w-full" />
      </BrowserFrame>
      <PhoneFrame>
        <PhotoPlaceholder caption="Foto 1 de 9" className="h-64 w-full" />
      </PhoneFrame>
    </div>
  ),
};
