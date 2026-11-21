import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppPreviewFrame } from './AppPreviewFrame.tsx';
import { AudienceSwitch } from './AudienceSwitch.tsx';
import { AudienceTag } from './AudienceTag.tsx';
import { FaqList } from './FaqList.tsx';
import { OfferCard } from './OfferCard.tsx';
import { PlanComparisonTable } from './PlanComparisonTable.tsx';

describe('audience page components', () => {
  it('AudienceSwitch marks only the current page and keeps real links', () => {
    render(
      <AudienceSwitch
        variant="tabs"
        label="Páginas por público"
        items={[
          {
            key: 'o',
            href: '/anunciar-imovel',
            label: 'Para proprietários',
            shortLabel: 'proprietários',
            current: false,
          },
          {
            key: 'b',
            href: '/para-corretores',
            label: 'Para corretores',
            shortLabel: 'corretores',
            current: true,
          },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Páginas por público' });
    const current = within(nav).getByRole('link', { name: 'corretores' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('href', '/para-corretores');
    expect(within(nav).getByRole('link', { name: 'proprietários' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('OfferCard lists included and excluded items apart', () => {
    render(
      <OfferCard
        name="Plano Corretor"
        tags={<AudienceTag kind="software">Software de gestão</AudienceTag>}
        price="R$ 99"
        period="por mês"
        included={{ title: 'Inclui', items: ['1 usuário'] }}
        excluded={{ title: 'Não inclui', items: ['Posição privilegiada na busca'] }}
        action={<button type="button">Começar</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Plano Corretor' })).toBeInTheDocument();
    expect(screen.getByText('R$ 99')).toBeInTheDocument();
    expect(screen.getByText('Não inclui')).toBeInTheDocument();
    expect(screen.getByText('Software de gestão')).toBeInTheDocument();
  });

  it('PlanComparisonTable is a captioned table with row headers and named checks', () => {
    render(
      <PlanComparisonTable
        caption="Planos para imobiliárias"
        featureHeader="Recurso"
        includedLabel="Incluído"
        plans={[
          { key: 'a', name: 'Essencial', price: 'R$ 299', period: 'por mês', action: null },
          { key: 'c', name: 'Operação maior', price: 'Sob consulta', action: null },
        ]}
        rows={[{ key: 'r', label: 'Gestão da carteira', values: [true, true] }]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Planos para imobiliárias' });
    expect(
      within(table).getByRole('rowheader', { name: 'Gestão da carteira' }),
    ).toBeInTheDocument();
    expect(within(table).getAllByText('Incluído')).toHaveLength(2);
    expect(within(table).getByText('Sob consulta')).toBeInTheDocument();
  });

  it('FaqList renders each question as a disclosure', () => {
    const { container } = render(
      <FaqList items={[{ key: 'q', question: 'O destaque está incluído?', answer: 'Não.' }]} />,
    );
    expect(container.querySelectorAll('details')).toHaveLength(1);
    expect(screen.getByText('O destaque está incluído?').tagName).toBe('SUMMARY');
  });

  it('AppPreviewFrame is one image with an accessible name and a visible note', () => {
    render(
      <AppPreviewFrame
        label="Exemplo ilustrativo: lista de imóveis"
        url="app.casvitta.com.br"
        title="Meus imóveis"
        userName="Ana Ribeiro"
        nav={[]}
        note="Exemplo ilustrativo"
      >
        <span>Apto 2 qts</span>
      </AppPreviewFrame>,
    );
    expect(
      screen.getByRole('img', { name: 'Exemplo ilustrativo: lista de imóveis' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Exemplo ilustrativo')).toBeInTheDocument();
  });
});
