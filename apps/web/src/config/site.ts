/**
 * Public-site configuration. Prices and limits come from config, never from components
 * (CLAUDE.md §1); defaults mirror apps/api settings.
 */
// NEXT_PUBLIC_* values must be referenced literally (process.env.NEXT_PUBLIC_X) so Next inlines
// them at build time; a dynamic process.env[key] read is empty at runtime in the Cloud Run image.
const env = (value: string | undefined, fallback: string) => value ?? fallback;
const int = (value: string | undefined, fallback: number) => Number(value ?? fallback);

/** Canonical marketplace origin for metadata, sitemap and robots. */
export const SITE_URL = env(process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000').replace(
  /\/$/,
  '',
);

/** Google Tag Manager container; empty string disables tracking (tests). */
export const GTM_ID = env(process.env.NEXT_PUBLIC_GTM_ID, 'GTM-KT3NQN2G');

export const COMPANY = {
  whatsappE164: env(process.env.NEXT_PUBLIC_COMPANY_WHATSAPP, '+5511927408912'),
  /** Casvitta's own CRECI-J. Placeholder until registered. */
  creci: env(process.env.NEXT_PUBLIC_COMPANY_CRECI, '[NÚMERO]'),
} as const;

export type PlanKey = 'essencial' | 'profissional';

export const PLANS: Record<PlanKey, { priceCents: number; maxActiveProperties: number }> = {
  essencial: {
    priceCents: int(process.env.NEXT_PUBLIC_PLAN_ESSENCIAL_PRICE_CENTS, 19_700),
    maxActiveProperties: int(process.env.NEXT_PUBLIC_PLAN_ESSENCIAL_MAX_ACTIVE_PROPERTIES, 3),
  },
  profissional: {
    priceCents: int(process.env.NEXT_PUBLIC_PLAN_PROFISSIONAL_PRICE_CENTS, 39_700),
    maxActiveProperties: int(process.env.NEXT_PUBLIC_PLAN_PROFISSIONAL_MAX_ACTIVE_PROPERTIES, 15),
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
