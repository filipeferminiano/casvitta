/**
 * Public-site configuration. Prices and limits come from config, never from components
 * (CLAUDE.md §1); defaults mirror apps/api settings.
 */
const env = (key: string, fallback: string) => process.env[key] ?? fallback;
const int = (key: string, fallback: number) => Number(process.env[key] ?? fallback);

/** Canonical marketplace origin for metadata, sitemap and robots. */
export const SITE_URL = env('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000').replace(/\/$/, '');

/** Google Tag Manager container; empty string disables tracking (tests). */
export const GTM_ID = env('NEXT_PUBLIC_GTM_ID', 'GTM-KT3NQN2G');

export const COMPANY = {
  whatsappE164: env('NEXT_PUBLIC_COMPANY_WHATSAPP', '+5511927408912'),
  /** Casvitta's own CRECI-J. Placeholder until registered. */
  creci: env('NEXT_PUBLIC_COMPANY_CRECI', '[NÚMERO]'),
} as const;

export type PlanKey = 'essencial' | 'profissional';

export const PLANS: Record<PlanKey, { priceCents: number; maxActiveProperties: number }> = {
  essencial: {
    priceCents: int('NEXT_PUBLIC_PLAN_ESSENCIAL_PRICE_CENTS', 19_700),
    maxActiveProperties: int('NEXT_PUBLIC_PLAN_ESSENCIAL_MAX_ACTIVE_PROPERTIES', 3),
  },
  profissional: {
    priceCents: int('NEXT_PUBLIC_PLAN_PROFISSIONAL_PRICE_CENTS', 39_700),
    maxActiveProperties: int('NEXT_PUBLIC_PLAN_PROFISSIONAL_MAX_ACTIVE_PROPERTIES', 15),
  },
};

/** "Contratando separado" comparison (54): public reference prices, nov/2026. */
export const SEPARATE_TOOLS_CENTS = {
  crm: 19_900,
  site: 3_900,
  aiService: 25_900,
  socialMedia: 50_000,
  trafficManager: 50_000,
} as const;

export const whatsappLink = (text?: string) =>
  `https://wa.me/${COMPANY.whatsappE164.replace('+', '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
