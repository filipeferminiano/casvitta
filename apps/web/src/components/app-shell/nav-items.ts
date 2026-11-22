import { isLive } from '@/lib/live';
import {
  Building2,
  Columns3,
  Inbox,
  UserRound,
  Calculator,
  CalendarDays,
  FileText,
  House,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Message keys under `nav` in messages/pt-BR.json. */
export type NavLabelKey =
  | 'home'
  | 'properties'
  | 'leads'
  | 'conversations'
  | 'calendar'
  | 'proposals'
  | 'ads'
  | 'tools'
  | 'moduleStore'
  | 'settings'
  | 'inbox'
  | 'contacts'
  | 'pipeline';

export type NavItem = {
  /** Route segment under app/(app)/app; also the visible path on app.casvitta.com.br. */
  segment: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
};

export const hrefFor = (item: NavItem) => `/${item.segment}`;

/**
 * With the live CRM ("crm" area) the menu follows the CRM mockups: Atendimento (Início, Caixa de
 * entrada, Contatos, Funil, Agenda) and Imóveis. The demo build keeps the Broker OS menu.
 */
const CRM_NAV: NavItem[] = [
  { segment: 'inicio', labelKey: 'home', icon: House },
  { segment: 'conversas', labelKey: 'inbox', icon: Inbox },
  { segment: 'contatos', labelKey: 'contacts', icon: UserRound },
  { segment: 'funil', labelKey: 'pipeline', icon: Columns3 },
  { segment: 'agenda', labelKey: 'calendar', icon: CalendarDays },
  { segment: 'imoveis', labelKey: 'properties', icon: Building2 },
];

const DEMO_NAV: NavItem[] = [
  { segment: 'inicio', labelKey: 'home', icon: House },
  { segment: 'imoveis', labelKey: 'properties', icon: Building2 },
  { segment: 'leads', labelKey: 'leads', icon: Users },
  { segment: 'conversas', labelKey: 'conversations', icon: MessageSquare },
  { segment: 'agenda', labelKey: 'calendar', icon: CalendarDays },
  { segment: 'propostas', labelKey: 'proposals', icon: FileText },
];

export const primaryNav: NavItem[] = isLive('crm') ? CRM_NAV : DEMO_NAV;

/** Shown under the "Módulos" heading. "Ads Studio" internally; the UI says "Anúncios". */
export const moduleNav: NavItem[] = [{ segment: 'anuncios', labelKey: 'ads', icon: Megaphone }];

export const footerNav: NavItem[] = [
  // Public tools a broker opens or sends to clients (valuation, ITBI, financing, price per m²).
  { segment: 'ferramentas', labelKey: 'tools', icon: Calculator },
  { segment: 'modulos', labelKey: 'moduleStore', icon: LayoutGrid },
  { segment: 'configuracoes', labelKey: 'settings', icon: Settings },
];

/** Mobile bottom tabs (DESIGN_SYSTEM.md §3). */
export const bottomTabs: NavItem[] = isLive('crm')
  ? [CRM_NAV[0]!, CRM_NAV[1]!, CRM_NAV[2]!, CRM_NAV[4]!, CRM_NAV[5]!]
  : [DEMO_NAV[0]!, DEMO_NAV[2]!, DEMO_NAV[3]!, DEMO_NAV[4]!, moduleNav[0]!];
