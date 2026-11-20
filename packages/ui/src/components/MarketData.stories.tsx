import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './Badge.tsx';
import { Breadcrumbs } from './Breadcrumbs.tsx';
import {
  LeadAlertForm,
  type LeadAlertFormLabels,
  type LeadAlertResult,
  type LeadAlertValues,
} from './LeadAlertForm.tsx';
import { MonthlySeriesChart, type MonthlyPoint } from './MonthlySeriesChart.tsx';
import { Skeleton } from './Skeleton.tsx';
import { SourceNote } from './SourceNote.tsx';
import { LoadingState } from './States.tsx';
import { StatTile } from './StatTile.tsx';
import { Tooltip, TooltipProvider } from './Tooltip.tsx';

const meta = { title: 'Domain/Market data' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const brl = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`;
const MONTHS = 'jan fev mar abr mai jun jul ago set out nov dez'.split(' ');
const monthLabel = (month: string) =>
  `${MONTHS[Number(month.slice(5, 7)) - 1]}/${month.slice(0, 4)}`;

/** Fictitious series: 60 months ending ago/2026. */
function series(gaps: number[] = []): MonthlyPoint[] {
  return Array.from({ length: 60 }, (_, i) => {
    const date = new Date(Date.UTC(2021, 8 + i, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const value = Math.round((9800 + i * 55 + Math.sin(i / 3) * 400) / 10) * 10;
    return {
      month,
      value: gaps.includes(i) ? null : value,
      count: 60 + Math.round(Math.cos(i / 4) * 25) + i,
    };
  });
}

const chartProps = {
  formatValue: brl,
  formatMonth: monthLabel,
  title: 'R$/m² de área construída (IPTU), mediana por mês',
  description: 'Barras: vendas registradas no mês. Meses com poucas vendas ficam sem linha.',
  countLabel: 'Vendas no mês',
  valueLabel: 'Mediana R$/m²',
  monthLabel: 'Mês',
};

export const BreadcrumbsLevels: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Breadcrumbs label="Você está em" items={[{ label: 'São Paulo' }]} />
      <Breadcrumbs
        label="Você está em"
        items={[
          { label: 'São Paulo', href: '#sp' },
          { label: 'Vila Mariana', href: '#vm' },
          { label: 'Rua Domingos de Morais' },
        ]}
      />
      <Breadcrumbs
        label="Você está em"
        items={[
          { label: 'São Paulo', href: '#sp' },
          { label: 'Vila Mariana', href: '#vm' },
          { label: 'Rua Domingos de Morais', href: '#rua' },
          { label: 'Edifício Exemplo' },
        ]}
      />
    </div>
  ),
};

export const TooltipOnStat: Story = {
  render: () => (
    <TooltipProvider>
      <div className="max-w-xs">
        <StatTile
          label={
            <span className="inline-flex items-center gap-1">
              R$/m² de área construída (IPTU)
              <Tooltip
                label="O que é área construída (IPTU)?"
                content="A área do cadastro do IPTU inclui a parte das áreas comuns do condomínio. Por isso o valor por m² fica abaixo do m² de anúncios, que usam área privativa."
              />
            </span>
          }
          value="R$ 11.240"
          caption="Mediana de 1.431 vendas em 12 meses"
          badge={<Badge variant="demo">Demonstrativo</Badge>}
          highlighted
        />
      </div>
    </TooltipProvider>
  ),
};

export const ChartFull: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-2">
      <Badge variant="demo" className="self-start">
        Demonstrativo
      </Badge>
      <MonthlySeriesChart points={series()} {...chartProps} />
    </div>
  ),
};

export const ChartWithGaps: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-2">
      <Badge variant="demo" className="self-start">
        Demonstrativo
      </Badge>
      <MonthlySeriesChart points={series([3, 4, 5, 20, 22, 40, 41])} {...chartProps} />
    </div>
  ),
};

export const ChartEmpty: Story = {
  render: () => (
    <div className="max-w-2xl">
      <MonthlySeriesChart
        points={[]}
        {...chartProps}
        description="Ainda não há vendas suficientes para mostrar a evolução mês a mês."
      />
    </div>
  ),
};

export const ChartLoading: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-4">
      <Skeleton className="h-48 w-full" />
      <LoadingState title="Carregando o histórico de vendas" description="Leva poucos segundos." />
    </div>
  ),
};

export const Source: Story = {
  render: () => (
    <SourceNote
      source="Fonte: Prefeitura de São Paulo — guias de ITBI"
      updated="Atualizado em 05/11/2026"
      items={['Vendas de set/2025 a ago/2026']}
    />
  ),
};

const labels: LeadAlertFormLabels = {
  title: 'Avise-me sobre imóveis na Vila Mariana',
  description: 'Mandamos uma mensagem quando um corretor anunciar um imóvel aqui.',
  name: 'Nome',
  whatsapp: 'WhatsApp',
  whatsappHelp: 'Com DDD, por exemplo (11) 92740-8912.',
  email: 'E-mail',
  emailOptional: '(opcional)',
  intentLabel: 'Você quer',
  intentBuy: 'Comprar aqui',
  intentOwner: 'Tenho um imóvel aqui',
  consentContact: 'Aceito receber contato sobre imóveis desta região.',
  consentMarketing: 'Aceito receber novidades da Casvitta.',
  consentRequired: 'Marque esta opção para podermos avisar você.',
  honeypot: 'Não preencha este campo',
  submit: 'Quero ser avisado',
  submitting: 'Enviando…',
  successTitle: 'Pronto, vamos avisar você.',
  successDescription: 'Quando houver um imóvel aqui, mandamos uma mensagem no seu WhatsApp.',
  errorTitle: 'Não conseguimos enviar',
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const AlertIdle: Story = {
  render: () => (
    <div className="max-w-md">
      <LeadAlertForm labels={labels} onSubmit={async () => ({ ok: true })} />
    </div>
  ),
};

export const AlertSubmitting: Story = {
  name: 'Alert submitting (fill and send: stays loading)',
  render: () => (
    <div className="max-w-md">
      <LeadAlertForm
        labels={labels}
        onSubmit={() => new Promise<LeadAlertResult>(() => undefined)}
      />
    </div>
  ),
};

export const AlertSuccess: Story = {
  name: 'Alert success (fill, check consent and send)',
  render: () => (
    <div className="max-w-md">
      <LeadAlertForm
        labels={labels}
        defaultIntent="owner"
        onSubmit={async () => {
          await delay(600);
          return { ok: true };
        }}
      />
    </div>
  ),
};

export const AlertServerError: Story = {
  name: 'Alert server error with field errors',
  render: () => (
    <div className="max-w-md">
      <LeadAlertForm
        labels={labels}
        onSubmit={async (_values: LeadAlertValues) => {
          await delay(400);
          return {
            ok: false,
            message: 'Confira o WhatsApp e tente de novo.',
            fieldErrors: { whatsapp: 'Use DDD + número, por exemplo (11) 92740-8912.' },
          };
        }}
      />
    </div>
  ),
};

export const AlertConsentRequired: Story = {
  name: 'Alert consent required (send without checking)',
  render: () => (
    <div className="max-w-md">
      <LeadAlertForm labels={labels} showIntent={false} onSubmit={async () => ({ ok: true })} />
    </div>
  ),
};
