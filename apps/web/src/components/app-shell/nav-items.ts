import {
  Building2,
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
  | 'moduleStore'
  | 'settings';

export type NavItem = {
  /** Route segment under app/(app)/app; also the visible path on app.casvitta.com.br. */
  segment: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
};

export const hrefFor = (item: NavItem) => `/${item.segment}`;

export const primaryNav: NavItem[] = [
  { segment: 'inicio', labelKey: 'home', icon: House },
  { segment: 'imoveis', labelKey: 'properties', icon: Building2 },
  { segment: 'leads', labelKey: 'leads', icon: Users },
  { segment: 'conversas', labelKey: 'conversations', icon: MessageSquare },
  { segment: 'agenda', labelKey: 'calendar', icon: CalendarDays },
  { segment: 'propostas', labelKey: 'proposals', icon: FileText },
];

/** Shown under the "Módulos" heading. "Ads Studio" internally; the UI says "Anúncios". */
export const moduleNav: NavItem[] = [{ segment: 'anuncios', labelKey: 'ads', icon: Megaphone }];

export const footerNav: NavItem[] = [
  { segment: 'modulos', labelKey: 'moduleStore', icon: LayoutGrid },
  { segment: 'configuracoes', labelKey: 'settings', icon: Settings },
];

/** Mobile bottom tabs (DESIGN_SYSTEM.md §3). */
export const bottomTabs: NavItem[] = [
  primaryNav[0]!,
  primaryNav[2]!,
  primaryNav[3]!,
  primaryNav[4]!,
  moduleNav[0]!,
];
