import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';

import { AddressAutocomplete, type AddressAutocompleteStatus } from './AddressAutocomplete.tsx';
import { Badge } from './Badge.tsx';
import { BreakdownTable } from './BreakdownTable.tsx';
import { Button } from './Button.tsx';
import { Chip } from './Chip.tsx';
import { ComparableGroupList } from './ComparableGroupList.tsx';
import { CurrencyInput } from './CurrencyInput.tsx';
import { FilterBar, FilterSheet } from './FilterBar.tsx';
import { LeadAlertForm, type LeadAlertFormLabels } from './LeadAlertForm.tsx';
import { ListingDataStrip } from './ListingDataStrip.tsx';
import { PropertyCard } from './PropertyCard.tsx';
import { ResultsHeader } from './ResultsHeader.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { Skeleton } from './Skeleton.tsx';
import { StatTile } from './StatTile.tsx';
import { TaxCalculatorCard } from './TaxCalculatorCard.tsx';
import { ValueRangeResult } from './ValueRangeResult.tsx';
import { ZeroResultsAlert } from './ZeroResultsAlert.tsx';

const meta = { title: 'Domain/SEO pages B' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const demo = <Badge variant="demo">Demonstrativo</Badge>;
const frame = (children: ReactNode) => (
  <div className="flex max-w-[420px] flex-col gap-3">
    {demo}
    {children}
  </div>
);

const ADDRESS_LABELS = {
  label: 'Endereço do imóvel',
  placeholder: 'Rua e número',
  help: 'Rua e número. Não precisa do apartamento.',
  coverage: 'Endereços de São Paulo · cobertura: capital',
  loading: 'Procurando endereços…',
  notFound: 'Não achamos esse endereço',
  outsideCoverage: 'Ainda não cobrimos este endereço',
};
const SUGGESTIONS = [
  { id: 'a', label: 'Rua Exemplo Fictícia, 1240', detail: 'Vila Mariana · São Paulo' },
  { id: 'b', label: 'Rua Exemplo Fictícia, 1240 — fundos', detail: 'Vila Mariana · São Paulo' },
  { id: 'c', label: 'Rua Exemplo Fictícia, 124', detail: 'Vila Mariana · São Paulo' },
];

function AddressDemo({ status, initial }: { status: AddressAutocompleteStatus; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <AddressAutocomplete
      value={value}
      status={status}
      suggestions={status === 'suggestions' ? SUGGESTIONS : []}
      onQueryChange={setValue}
      onSelect={(s) => setValue(s.label)}
      labels={ADDRESS_LABELS}
      error={status === 'not_found' ? 'Informe rua e número' : undefined}
    />
  );
}

export const AddressAutocompleteStates: Story = {
  render: () =>
    frame(
      <>
        <AddressDemo status="idle" initial="" />
        <AddressDemo status="suggestions" initial="Rua Exemplo Fic" />
        <AddressDemo status="loading" initial="Rua Exemplo" />
        <AddressDemo status="not_found" initial="Rua Que Não Existe, 9" />
        <AddressDemo status="outside_coverage" initial="Rua Fora, 10 — Santos" />
      </>,
    ),
};

const tooltipLabel = <span>R$/m² de área construída (IPTU)</span>;
const GROUPS = [
  {
    key: 'street',
    description: 'Apartamentos de 90–120 m² na Rua Exemplo Fictícia',
    scope: 'mesma rua',
    sales: '62 vendas',
    median: 'mediana R$ 775 mil',
  },
  {
    key: 'nbhd',
    description: 'Apartamentos de 90–120 m² na Vila Mariana',
    scope: 'mesmo tamanho, mesmo bairro',
    sales: '138 vendas',
    median: 'mediana R$ 742 mil',
  },
];

export const ValueRangeStates: Story = {
  render: () =>
    frame(
      <>
        <ValueRangeResult
          title="Estimativa de valor de venda"
          state="loading"
          loadingLabel="Procurando vendas comparáveis…"
        />
        <ValueRangeResult
          title="Estimativa de valor de venda"
          subject="Apartamento · 100 m² · Rua Exemplo Fictícia, 1240"
          state="alta"
          range="R$ 690–810 mil"
          center="Valor central R$ 748 mil"
          priceM2Label={tooltipLabel}
          priceM2="R$ 7.480"
          barLabels={{ low: 'menor', center: 'valor central', high: 'maior' }}
          confidenceLabel="Confiança alta"
          basis="baseado em 200 vendas comparáveis na mesma rua e no mesmo bairro"
          groups={
            <ComparableGroupList
              title="Como chegamos neste valor"
              description="Grupos de vendas parecidas. Nunca mostramos uma venda isolada."
              groups={GROUPS}
              fewSalesLabel="poucas vendas"
            />
          }
          disclaimer="Estimativa estatística a partir de preços pagos. Não é laudo de avaliação."
          source={
            <p className="type-caption">
              Fonte: Prefeitura de São Paulo — guias de ITBI · Atualizado em 05/09/2026
            </p>
          }
        />
        <ValueRangeResult
          title="Estimativa de valor de venda"
          subject="Casa · 200 m² · Rua Exemplo Fictícia, 310"
          state="baixa"
          range="R$ 1,05–1,55 mi"
          center="Valor central R$ 1,30 mi"
          priceM2Label={tooltipLabel}
          priceM2="R$ 6.120"
          confidenceLabel="Confiança baixa"
          basis="baseado em 11 vendas comparáveis em bairros vizinhos"
          lowConfidenceNote="Poucas vendas parecidas por perto. Use como referência inicial."
          groups={
            <ComparableGroupList
              title="Como chegamos neste valor"
              groups={[
                {
                  key: 'n',
                  description: 'Casas de 150–250 m² em bairros vizinhos',
                  sales: '11 vendas',
                  median: 'mediana R$ 1,32 mi',
                },
                {
                  key: 's',
                  description: 'Casas na Rua Exemplo Fictícia',
                  scope: 'abaixo de 10 vendas: sem preço',
                  sales: '4 vendas',
                  median: null,
                },
              ]}
              fewSalesLabel="poucas vendas"
            />
          }
          disclaimer="Estimativa estatística a partir de preços pagos. Não é laudo de avaliação."
        />
      </>,
    ),
};

const ALERT_LABELS: LeadAlertFormLabels = {
  title: 'Quer um valor exato?',
  description: 'Um corretor parceiro, com CRECI, pode avaliar com base em vendas parecidas.',
  name: 'Nome',
  whatsapp: 'WhatsApp',
  whatsappHelp: 'Com DDD, como (11) 90000-0000.',
  email: 'E-mail',
  emailOptional: '(opcional)',
  intentLabel: 'O que você quer?',
  consentContact: 'Aceito ser contatado sobre imóveis',
  consentMarketing: 'Também quero receber novidades (opcional)',
  consentRequired: 'Marque para continuar',
  honeypot: 'Não preencha este campo',
  submit: 'Pedir avaliação',
  submitting: 'Enviando…',
  successTitle: 'Pedido registrado',
  successDescription: 'Guardamos seu pedido para esta região.',
  errorTitle: 'Não conseguimos registrar agora',
  privacyLine: 'Usamos seus dados só para este contato, conforme a LGPD.',
};

export const LeadAlertValuationIntents: Story = {
  render: () =>
    frame(
      <LeadAlertForm
        labels={ALERT_LABELS}
        intents={[
          { value: 'own_sell', label: 'Quero vender' },
          { value: 'own_rent', label: 'Quero alugar' },
          { value: 'own_valuation', label: 'Só quero saber o valor' },
        ]}
        onSubmit={async () => ({ ok: true })}
      />,
    ),
};

export const LeadAlertWithChipsAndBudget: Story = {
  render: () =>
    frame(
      <LeadAlertForm
        labels={{ ...ALERT_LABELS, title: 'Avise-me quando houver', submit: 'Criar alerta' }}
        intents={[
          { value: 'rent', label: 'Quero alugar' },
          { value: 'buy', label: 'Quero comprar' },
        ]}
        chips={[
          <Chip key="t">Aluguel</Chip>,
          <Chip key="k">Apartamento</Chip>,
          <Chip key="q">2+ quartos</Chip>,
        ]}
        extraField={{ name: 'budget', label: 'Orçamento', kind: 'currency', help: 'Opcional' }}
        onSubmit={async () => ({ ok: true })}
      />,
    ),
};

function TaxInputs({ financed }: { financed: boolean }) {
  const [price, setPrice] = useState<number | null>(75_000_000);
  return (
    <>
      <CurrencyInput label="Preço de compra" value={price} onValueChange={setPrice} />
      <SegmentedControl
        label="Vai financiar?"
        value={financed ? 'yes' : 'no'}
        onValueChange={() => undefined}
        options={[
          { value: 'no', label: 'Não' },
          { value: 'yes', label: 'Sim' },
        ]}
      />
      <Button>Calcular ITBI</Button>
    </>
  );
}

const review = <Badge variant="soon">texto a revisar</Badge>;

export const TaxCalculatorStates: Story = {
  render: () =>
    frame(
      <>
        <TaxCalculatorCard
          title="Calculadora de ITBI · São Paulo"
          rateChip="alíquota 3%"
          reviewMarker={review}
          state="empty"
          resultLabel="ITBI estimado"
          emptyHint="Preencha o preço de compra para calcular."
        >
          <TaxInputs financed={false} />
        </TaxCalculatorCard>
        <TaxCalculatorCard
          title="Calculadora de ITBI · São Paulo"
          rateChip="alíquota 3%"
          state="result"
          resultLabel="ITBI estimado"
          total="R$ 22.500,00"
          base="Base de cálculo usada: R$ 750.000 · o maior entre preço e valor venal"
          breakdown={
            <BreakdownTable
              caption="Cálculo do ITBI"
              rows={[
                {
                  key: 'all',
                  label: 'Valor total',
                  formula: 'R$ 750.000 × 3%',
                  amount: 'R$ 22.500,00',
                },
              ]}
              totalLabel="Total"
              total="R$ 22.500,00"
            />
          }
          disclaimer="Valor estimado. Confirme na guia oficial da Prefeitura."
        >
          <TaxInputs financed={false} />
        </TaxCalculatorCard>
        <TaxCalculatorCard
          title="Calculadora de ITBI · São Paulo"
          rateChip="alíquota 3%"
          reviewMarker={review}
          state="result"
          resultLabel="ITBI estimado"
          total="R$ 7.500,00"
          base="Base de cálculo usada: R$ 750.000 · o maior entre preço e valor venal"
          breakdown={
            <BreakdownTable
              caption="Cálculo do ITBI"
              rows={[
                {
                  key: 'sfh',
                  label: <>Financiada pelo SFH {review}</>,
                  formula: 'R$ 600.000 × 0,5%',
                  amount: 'R$ 3.000,00',
                },
                {
                  key: 'rest',
                  label: 'Restante do valor',
                  formula: 'R$ 150.000 × 3%',
                  amount: 'R$ 4.500,00',
                },
              ]}
              totalLabel="Total"
              total="R$ 7.500,00"
            />
          }
          disclaimer="Valor estimado. Confirme na guia oficial da Prefeitura."
          extra="Escritura e registro em cartório (estimativa): valores conforme a tabela vigente."
        >
          <TaxInputs financed />
        </TaxCalculatorCard>
      </>,
    ),
};

const broker = (
  <>
    Corretora Fictícia <Badge variant="creci">CRECI-SP 000.000-F</Badge>
  </>
);

export const RentalCards: Story = {
  render: () =>
    frame(
      <>
        <PropertyCard
          title="Apartamento para alugar · Vila Mariana"
          price="R$ 3.800/mês"
          costLines={[
            { key: 'c', label: '+ cond. R$ 980' },
            { key: 'i', label: '+ IPTU R$ 160' },
          ]}
          costTotal="Total R$ 4.940/mês"
          specs="2 qts · 68 m² · 1 vaga"
          badges={
            <>
              <Badge variant="sponsored">Destaque pago</Badge>
              {demo}
            </>
          }
          broker={broker}
        />
        <PropertyCard
          title="Apartamento para alugar · Vila Clementino"
          kicker="Bairro vizinho"
          price="R$ 3.700/mês"
          costLines={[
            { key: 'c', label: '+ cond. R$ 900' },
            { key: 'i', label: '+ IPTU R$ 140' },
          ]}
          costTotal="Total R$ 4.740/mês"
          specs="2 qts · 70 m² · 1 vaga"
          badges={demo}
          broker={broker}
        />
      </>,
    ),
};

const views = (current: 'list' | 'map') => [
  { key: 'list' as const, label: 'Lista', href: '?', current: current === 'list' },
  { key: 'map' as const, label: 'Mapa', href: '?vista=mapa', current: current === 'map' },
];

export const ResultsHeaderStates: Story = {
  render: () =>
    frame(
      <>
        <ResultsHeader
          count="7 anúncios · só anúncios autorizados, com CRECI"
          sort={<span className="type-body-s">Ordenar: Mais recentes</span>}
          views={views('list')}
          viewsLabel="Visualização"
        />
        <ResultsHeader count="0 anúncios" />
        <ResultsHeader count={<Skeleton className="w-40" />} loading />
        <div className="grid gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </>,
    ),
};

function FiltersDemo({ withFilters, sheetOpen }: { withFilters: boolean; sheetOpen: boolean }) {
  const [open, setOpen] = useState(sheetOpen);
  const [active, setActive] = useState(
    withFilters
      ? [
          { key: 'q', label: '2+ quartos', removeLabel: 'Remover 2+ quartos' },
          { key: 'p', label: 'Até R$ 5.000', removeLabel: 'Remover Até R$ 5.000' },
        ]
      : [],
  );
  return (
    <>
      <FilterBar
        controls={<span className="type-body-s">Tipo · Quartos · Preço · Vagas · Área</span>}
        active={active}
        onRemove={(key) => setActive((a) => a.filter((f) => f.key !== key))}
        clearLabel="Limpar filtros"
        onClear={() => setActive([])}
        filtersLabel="Filtros"
        onOpenSheet={() => setOpen(true)}
      />
      <FilterSheet
        open={open}
        onOpenChange={setOpen}
        title="Filtros"
        closeLabel="Fechar filtros"
        clearLabel="Limpar"
        onClear={() => setActive([])}
        applyLabel="Ver 5 anúncios"
        onApply={() => setOpen(false)}
      >
        <SegmentedControl
          label="Quartos"
          value="2"
          onValueChange={() => undefined}
          options={['1', '2', '3', '4'].map((n) => ({ value: n, label: `${n}+` }))}
        />
      </FilterSheet>
    </>
  );
}

export const FilterBarStates: Story = {
  render: () =>
    frame(
      <>
        <FiltersDemo withFilters={false} sheetOpen={false} />
        <FiltersDemo withFilters sheetOpen={false} />
      </>,
    ),
};

export const FilterSheetOpen: Story = {
  render: () => frame(<FiltersDemo withFilters sheetOpen />),
};

export const DataStrip: Story = {
  render: () =>
    frame(
      <>
        <ListingDataStrip title="Antes de alugar, veja os prédios">
          <ul className="type-body-s">
            <li>Condomínio Exemplo · 1998 · 56 apartamentos</li>
            <li>Edifício Fictício · 2005 · 40 apartamentos</li>
          </ul>
        </ListingDataStrip>
        <ListingDataStrip title="Preço real pago nesta região">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Preço mediano" value="R$ 750.000" />
            <StatTile label="R$/m² (IPTU)" value="R$ 6.940" />
          </div>
        </ListingDataStrip>
      </>,
    ),
};

export const ZeroResults: Story = {
  render: () =>
    frame(
      <ZeroResultsAlert
        title="Ainda não há apartamentos para alugar na Rua Exemplo Fictícia."
        description="Crie um alerta para esta rua com os filtros abaixo."
        form={
          <LeadAlertForm
            labels={{ ...ALERT_LABELS, title: 'Avise-me quando houver', submit: 'Criar alerta' }}
            intents={[
              { value: 'rent', label: 'Quero alugar' },
              { value: 'buy', label: 'Quero comprar' },
            ]}
            chips={[<Chip key="a">Aluguel</Chip>, <Chip key="r">Rua Exemplo Fictícia</Chip>]}
            onSubmit={async () => ({ ok: true })}
          />
        }
        links={[
          { key: 'street', label: 'Ver a Rua Exemplo Fictícia →', href: '#' },
          { key: 'nbhd', label: 'Para alugar na Vila Mariana (7) →', href: '#' },
        ]}
        linksLabel="Veja também"
      />,
    ),
};
