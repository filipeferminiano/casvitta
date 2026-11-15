/**
 * Every implemented screen with the mockup it reproduces (docs/mockups/). Used by the dev index
 * (/dev/screens) and by `pnpm screens:capture`.
 */
export type ScreenEntry = {
  mockup: string; // file name without extension
  title: string;
  host: 'app' | 'marketplace' | 'landing';
  path: string;
  viewport: 'desktop' | 'mobile';
};

export const SCREENS: ScreenEntry[] = [
  {
    mockup: '04-information-architecture-module-store',
    title: 'Loja de módulos',
    host: 'app',
    path: '/modulos',
    viewport: 'desktop',
  },
  {
    mockup: '10-ads-studio-1-select-property',
    title: 'Anúncios · 1 Imóvel',
    host: 'app',
    path: '/anuncios/novo?imovel=prop-vm',
    viewport: 'desktop',
  },
  {
    mockup: '11-ads-studio-2-ai-ad',
    title: 'Anúncios · 2 Anúncio',
    host: 'app',
    path: '/anuncios/novo/anuncio?imovel=prop-vm',
    viewport: 'desktop',
  },
  {
    mockup: '12-ads-studio-3-publish',
    title: 'Anúncios · 3 Publicar',
    host: 'app',
    path: '/anuncios/novo/publicar?imovel=prop-vm',
    viewport: 'desktop',
  },
  {
    mockup: '13-marketplace-property-detail',
    title: 'Marketplace · imóvel',
    host: 'marketplace',
    path: '/imovel/apto-vila-mariana',
    viewport: 'desktop',
  },
  {
    mockup: '14-ads-studio-lead-received',
    title: 'Anúncio no ar',
    host: 'app',
    path: '/anuncios/camp-vm',
    viewport: 'desktop',
  },
  {
    mockup: '15-whatsapp-qualification',
    title: 'Qualificação no WhatsApp',
    host: 'app',
    path: '/conversas/conv-marcos',
    viewport: 'desktop',
  },
  {
    mockup: '16-visit-booked',
    title: 'Visita agendada',
    host: 'app',
    path: '/agenda/visitas/appt-marcos',
    viewport: 'desktop',
  },
  {
    mockup: '17-weekly-report',
    title: 'Relatório semanal',
    host: 'app',
    path: '/anuncios/relatorios/rep-vm-1',
    viewport: 'desktop',
  },
  {
    mockup: '20-mobile-broker-publish',
    title: 'Mobile · Publicar',
    host: 'app',
    path: '/anuncios/novo?imovel=prop-vm',
    viewport: 'mobile',
  },
  {
    mockup: '21-mobile-broker-new-lead',
    title: 'Mobile · Lead novo',
    host: 'app',
    path: '/leads/lead-marcos',
    viewport: 'mobile',
  },
  {
    mockup: '22-mobile-broker-conversation',
    title: 'Mobile · Conversa',
    host: 'app',
    path: '/conversas/conv-marcos',
    viewport: 'mobile',
  },
  {
    mockup: '23-mobile-broker-report',
    title: 'Mobile · Relatório',
    host: 'app',
    path: '/anuncios/relatorios/rep-vm-1',
    viewport: 'mobile',
  },
  {
    mockup: '24-mobile-buyer-listing',
    title: 'Mobile · Anúncio (comprador)',
    host: 'marketplace',
    path: '/imovel/apto-vila-mariana',
    viewport: 'mobile',
  },
  {
    mockup: '25-mobile-buyer-chat',
    title: 'Mobile · Conversa (comprador)',
    host: 'marketplace',
    path: '/imovel/apto-vila-mariana/conversa',
    viewport: 'mobile',
  },
  {
    mockup: '26-mobile-buyer-visit-confirmed',
    title: 'Mobile · Visita confirmada',
    host: 'marketplace',
    path: '/imovel/apto-vila-mariana/visita-confirmada?horario=2026-11-21T10:00:00-03:00',
    viewport: 'mobile',
  },
  {
    mockup: '30-broker-os-dashboard',
    title: 'Início',
    host: 'app',
    path: '/inicio',
    viewport: 'desktop',
  },
  {
    mockup: '31-broker-os-crm-kanban',
    title: 'Leads · Kanban',
    host: 'app',
    path: '/leads',
    viewport: 'desktop',
  },
  {
    mockup: '32-broker-os-lead-detail',
    title: 'Detalhe do lead',
    host: 'app',
    path: '/leads/lead-marcos',
    viewport: 'desktop',
  },
  {
    mockup: '33-broker-os-inbox-ai',
    title: 'Conversas',
    host: 'app',
    path: '/conversas',
    viewport: 'desktop',
  },
  {
    mockup: '34-broker-os-calendar',
    title: 'Agenda',
    host: 'app',
    path: '/agenda',
    viewport: 'desktop',
  },
  {
    mockup: '35-broker-os-proposals',
    title: 'Propostas',
    host: 'app',
    path: '/propostas',
    viewport: 'desktop',
  },
  {
    mockup: '36-mobile-broker-inbox',
    title: 'Mobile · Conversas',
    host: 'app',
    path: '/conversas',
    viewport: 'mobile',
  },
  {
    mockup: '37-mobile-broker-calendar',
    title: 'Mobile · Agenda',
    host: 'app',
    path: '/agenda',
    viewport: 'mobile',
  },
  {
    mockup: '40-landing-property-page',
    title: 'Landing · imóvel',
    host: 'landing',
    path: '/apto-vila-mariana',
    viewport: 'desktop',
  },
  {
    mockup: '41-landing-broker-page',
    title: 'Landing · corretora',
    host: 'landing',
    path: '/',
    viewport: 'desktop',
  },
  {
    mockup: '42-social-media-calendar',
    title: 'Anúncios · redes sociais',
    host: 'app',
    path: '/anuncios/redes-sociais',
    viewport: 'desktop',
  },
];

export function screenUrl(
  entry: ScreenEntry,
  rootDomain: string,
  brokerSlug = 'anaribeiro',
): string {
  const host =
    entry.host === 'app'
      ? `app.${rootDomain}`
      : entry.host === 'landing'
        ? `${brokerSlug}.${rootDomain}`
        : rootDomain;
  return `http://${host}${entry.path}`;
}
