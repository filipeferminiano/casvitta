import type { Meta, StoryObj } from '@storybook/react-vite';
import { Building2, Contact, House, Megaphone, Target } from 'lucide-react';

import { AppPreviewFrame, UsageMeter } from './AppPreviewFrame.tsx';
import { AudienceSwitch } from './AudienceSwitch.tsx';
import { AudienceTag, AudienceTagLegend } from './AudienceTag.tsx';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { FaqList } from './FaqList.tsx';
import { FeatureCard, OfferCard } from './OfferCard.tsx';
import { PlanComparisonTable } from './PlanComparisonTable.tsx';

const meta = { title: 'Domain/Audience pages' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Story args only: the pages read every price from apps/web/src/config/site.ts (OFFERS).

export const Tags: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <AudienceTag kind="software">Software de gestão</AudienceTag>
        <AudienceTag kind="portal">Publicação no portal</AudienceTag>
        <AudienceTag kind="highlight">Destaque · opcional</AudienceTag>
      </div>
      <AudienceTagLegend
        label="Como diferenciamos as três coisas"
        items={[
          {
            kind: 'software',
            tag: 'Software de gestão',
            meaning: 'ferramenta de trabalho diário, por assinatura',
          },
          {
            kind: 'portal',
            tag: 'Publicação no portal',
            meaning: 'imóvel visível no portal Casvitta, na ordem normal da busca',
          },
          {
            kind: 'highlight',
            tag: 'Destaque · opcional',
            meaning: 'maior exposição dentro do portal, cobrada à parte',
          },
        ]}
      />
    </div>
  ),
};

const ownerItems = (days: number) => [
  'Publicação de 1 imóvel no portal Casvitta',
  'Venda ou aluguel',
  'Contatos dos interessados direto com você',
  'Sem assinatura de software',
  `Encerra ao fim dos ${days} dias`,
];

export const OwnerPacks: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <OfferCard
        name="1 imóvel por 30 dias"
        tags={<AudienceTag kind="portal">Publicação no portal</AudienceTag>}
        price="R$ 59"
        period="pagamento único"
        included={{ items: ownerItems(30) }}
        action={<Button variant="secondary">Anunciar por 30 dias</Button>}
      />
      <OfferCard
        highlighted
        name="1 imóvel por 90 dias"
        tags={<AudienceTag kind="portal">Publicação no portal</AudienceTag>}
        price="R$ 149"
        period="pagamento único"
        included={{ items: ownerItems(90) }}
        action={<Button>Anunciar por 90 dias</Button>}
      />
    </div>
  ),
};

export const BrokerPlan: Story = {
  render: () => (
    <OfferCard
      className="max-w-3xl"
      highlighted
      name="Plano Corretor"
      tags={
        <>
          <AudienceTag kind="software">Software de gestão</AudienceTag>
          <AudienceTag kind="portal">Publicação no portal</AudienceTag>
        </>
      }
      price="R$ 99"
      period="por mês"
      included={{
        title: 'Inclui',
        items: [
          '1 usuário',
          'Até 50 imóveis ativos',
          'Cadastro e organização de imóveis',
          'Organização de contatos e acompanhamento de oportunidades',
          'Publicação no portal Casvitta, dentro do limite do plano',
        ],
      }}
      excluded={{
        title: 'Não inclui',
        items: [
          'Destaques no portal: opcionais, cobrados à parte',
          'Posição privilegiada na busca',
          'Campanhas no Google ou nas redes sociais',
        ],
      }}
      action={<Button>Começar com a Casvitta</Button>}
      note="Cobrança mensal. Cancele quando quiser: o acesso continua até o fim do período pago."
    />
  ),
};

export const AgencyPlans: Story = {
  render: () => (
    <PlanComparisonTable
      className="max-w-5xl"
      caption="Planos para imobiliárias"
      featureHeader="Recurso"
      includedLabel="Incluído"
      plans={[
        {
          key: 'essencial',
          name: 'Essencial',
          price: 'R$ 299',
          period: 'por mês',
          action: <Button variant="secondary">Agendar demonstração</Button>,
        },
        {
          key: 'equipe',
          name: 'Equipe',
          price: 'R$ 499',
          period: 'por mês',
          highlighted: true,
          action: <Button>Agendar demonstração</Button>,
        },
        {
          key: 'operacao',
          name: 'Operação maior',
          price: 'Sob consulta',
          action: <Button variant="secondary">Falar com a equipe</Button>,
        },
      ]}
      rows={[
        { key: 's-limits', section: 'Limites' },
        {
          key: 'properties',
          label: 'Imóveis ativos',
          values: ['até 200', 'até 500', 'conforme a necessidade'],
        },
        {
          key: 'users',
          label: 'Usuários incluídos',
          values: ['5', '15', 'conforme a necessidade'],
        },
        { key: 's-features', section: 'Recursos' },
        { key: 'portfolio', label: 'Gestão da carteira', values: [true, true, true] },
        {
          key: 'highlight',
          label: 'Destaques no portal',
          values: ['à parte', 'à parte', 'à parte'],
        },
      ]}
    />
  ),
};

export const Faq: Story = {
  render: () => (
    <FaqList
      className="max-w-3xl"
      defaultOpen
      items={[
        {
          key: 'cost',
          question: 'A publicação tem custo adicional?',
          answer:
            'Não. A publicação no portal Casvitta está incluída na assinatura, até o limite de 50 imóveis ativos.',
        },
        {
          key: 'limit',
          question: 'Quantos imóveis posso manter ativos?',
          answer:
            'Até 50 ao mesmo tempo. Imóveis vendidos, alugados ou pausados não contam no limite.',
        },
      ]}
    />
  ),
};

const switchItems = (current: string) =>
  [
    { key: 'owners', href: '#owners', label: 'Para proprietários', shortLabel: 'proprietários' },
    { key: 'brokers', href: '#brokers', label: 'Para corretores', shortLabel: 'corretores' },
    { key: 'agencies', href: '#agencies', label: 'Para imobiliárias', shortLabel: 'imobiliárias' },
  ].map((item) => ({ ...item, current: item.key === current }));

export const AudienceSwitchNavAndTabs: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-6">
      <AudienceSwitch variant="nav" label="Páginas por público" items={switchItems('brokers')} />
      <AudienceSwitch variant="tabs" label="Páginas por público" items={switchItems('agencies')} />
    </div>
  ),
};

export const ProductPreview: Story = {
  render: () => (
    <AppPreviewFrame
      className="max-w-xl"
      label="Exemplo ilustrativo: lista de imóveis no software Casvitta"
      url="app.casvitta.com.br"
      title="Meus imóveis"
      userName="Ana Ribeiro"
      nav={[
        { key: 'props', label: 'Imóveis', icon: <House />, active: true },
        { key: 'contacts', label: 'Contatos', icon: <Contact /> },
        { key: 'opps', label: 'Oportunidades', icon: <Target /> },
        { key: 'portal', label: 'Portal', icon: <Megaphone /> },
      ]}
      note={
        <>
          <Badge variant="demo">Demonstrativo</Badge> Exemplo ilustrativo
        </>
      }
    >
      <UsageMeter label="imóveis ativos no plano" value={32} max={50} valueLabel="32 de 50" />
    </AppPreviewFrame>
  ),
};

export const FeatureCards: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <FeatureCard
        icon={<Building2 strokeWidth={1.6} />}
        title="Informações centralizadas"
        description="Imóveis, fotos, valores e contatos num só cadastro, usado por todos."
      />
      <FeatureCard
        icon={<Target strokeWidth={1.6} />}
        title="Oportunidades acompanhadas"
        description="Veja em que etapa está cada atendimento e o que está parado há dias."
      />
    </div>
  ),
};
