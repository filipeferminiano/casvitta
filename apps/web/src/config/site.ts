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

/** Search Console HTML-tag verification token; empty omits the tag (DNS verification preferred). */
export const GOOGLE_SITE_VERIFICATION = env(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, '');

export const COMPANY = {
  whatsappE164: env(process.env.NEXT_PUBLIC_COMPANY_WHATSAPP, '+5511927408912'),
  /** Casvitta's own CRECI-J. Placeholder until registered. */
  creci: env(process.env.NEXT_PUBLIC_COMPANY_CRECI, '[NÚMERO]'),
} as const;

/** Optional integer: unset or empty means "not defined" (null), never 0. */
const intOrNull = (value: string | undefined): number | null =>
  value === undefined || value.trim() === '' ? null : Number(value);

/**
 * Offer catalog for the audience pages (/anunciar-imovel, /para-corretores, /para-imobiliarias),
 * signup, llms.txt and structured data. Hypotheses (nov/2026), not validated prices: never shown
 * as a promotion or discount. Mirrors apps/api settings.offer_*. A null price is never rendered
 * as a number ("Sob consulta", highlight "a definir").
 */
export type OwnerPack = { key: '30d' | '90d'; days: 30 | 90; priceCents: number };
export type BrokerPlan = {
  key: 'corretor';
  priceCents: number;
  maxUsers: number;
  maxActiveProperties: number;
};
/** null = "Sob consulta" / "conforme a necessidade". */
export type AgencyPlan = {
  key: 'essencial' | 'equipe' | 'operacao';
  priceCents: number | null;
  maxUsers: number | null;
  maxActiveProperties: number | null;
};
export type Offers = {
  ownerPacks: OwnerPack[];
  brokerPlan: BrokerPlan;
  agencyPlans: AgencyPlan[];
  /** Destaque: optional, per property and period; null until a price is defined. */
  highlight: { priceCents: number | null };
};

export const OFFERS: Offers = {
  ownerPacks: [
    {
      key: '30d',
      days: 30,
      priceCents: int(process.env.NEXT_PUBLIC_OFFER_OWNER_30D_PRICE_CENTS, 5_900),
    },
    {
      key: '90d',
      days: 90,
      priceCents: int(process.env.NEXT_PUBLIC_OFFER_OWNER_90D_PRICE_CENTS, 14_900),
    },
  ],
  brokerPlan: {
    key: 'corretor',
    priceCents: int(process.env.NEXT_PUBLIC_OFFER_BROKER_PRICE_CENTS, 9_900),
    maxUsers: int(process.env.NEXT_PUBLIC_OFFER_BROKER_MAX_USERS, 1),
    maxActiveProperties: int(process.env.NEXT_PUBLIC_OFFER_BROKER_MAX_ACTIVE_PROPERTIES, 50),
  },
  agencyPlans: [
    {
      key: 'essencial',
      priceCents: int(process.env.NEXT_PUBLIC_OFFER_AGENCY_ESSENCIAL_PRICE_CENTS, 29_900),
      maxUsers: int(process.env.NEXT_PUBLIC_OFFER_AGENCY_ESSENCIAL_MAX_USERS, 5),
      maxActiveProperties: int(
        process.env.NEXT_PUBLIC_OFFER_AGENCY_ESSENCIAL_MAX_ACTIVE_PROPERTIES,
        200,
      ),
    },
    {
      key: 'equipe',
      priceCents: int(process.env.NEXT_PUBLIC_OFFER_AGENCY_EQUIPE_PRICE_CENTS, 49_900),
      maxUsers: int(process.env.NEXT_PUBLIC_OFFER_AGENCY_EQUIPE_MAX_USERS, 15),
      maxActiveProperties: int(
        process.env.NEXT_PUBLIC_OFFER_AGENCY_EQUIPE_MAX_ACTIVE_PROPERTIES,
        500,
      ),
    },
    // "Sob consulta": price and limits agreed case by case.
    { key: 'operacao', priceCents: null, maxUsers: null, maxActiveProperties: null },
  ],
  highlight: { priceCents: intOrNull(process.env.NEXT_PUBLIC_OFFER_HIGHLIGHT_PRICE_CENTS) },
};
// Assisted migration is always quoted apart ("orçamento separado"): no price in config.

/** Plan a broker signs up to. Legacy workspaces may still be on essencial/profissional. */
export type PlanKey = 'corretor';
export type WorkspacePlan = PlanKey | 'essencial' | 'profissional';

/**
 * @deprecated Old Essencial/Profissional table, read only by the mockup-54 screen until it is
 * replaced by the new /para-corretores page.
 */
export const LEGACY_PLANS = {
  essencial: { priceCents: 19_700, maxActiveProperties: 3 },
  profissional: { priceCents: 39_700, maxActiveProperties: 15 },
} as const;

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
