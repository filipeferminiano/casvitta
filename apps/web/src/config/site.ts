/**
 * Public-site configuration. Prices and limits come from config, never from components
 * (CLAUDE.md §1); defaults mirror apps/api settings.
 */
import { CATALOG } from '@/config/catalog';
import type { ServingRules } from '@/lib/highlights/serving';

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

/**
 * Offer catalog for the audience pages (/anunciar-imovel, /para-corretores, /para-imobiliarias),
 * signup, llms.txt and structured data. Hypotheses (nov/2026), not validated prices: never shown
 * as a promotion or discount. Owner packs and Destaques come from the plan catalog
 * (src/config/catalog.ts). `brokerPlan` and `agencyPlans` are the previous landing-page offer,
 * kept only until the audience pages are rebuilt on the catalog (PROMPT_CRM_BUILD §1); nothing
 * new reads them. A null price is never rendered as a number ("Sob consulta").
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
export type HighlightPackage = { days: 7 | 30; priceCents: number };
export type Offers = {
  ownerPacks: OwnerPack[];
  brokerPlan: BrokerPlan;
  agencyPlans: AgencyPlan[];
  /**
   * Destaque: optional, fixed price per property and period, sold apart from publishing. Prices
   * confirmed as hypotheses on 21/11/2026 (`effectiveFrom`).
   */
  highlight: { effectiveFrom: string; packages: HighlightPackage[] };
};

export const OFFERS: Offers = {
  ownerPacks: CATALOG.owner_packages.map((p) => ({
    key: p.days === 30 ? '30d' : '90d',
    days: p.days as 30 | 90,
    priceCents: p.price_cents,
  })),
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
  highlight: {
    effectiveFrom: CATALOG.highlight_effective_from,
    packages: CATALOG.highlight_packages.map((p) => ({
      days: p.days as 7 | 30,
      priceCents: p.price_cents,
    })),
  },
};
// Assisted migration is always quoted apart ("orçamento separado"): no price in config.

/** Destaques serving rules (mockup 45). Changing them needs the AdOps "Administração" permission. */
export const HIGHLIGHT_SERVING: ServingRules = {
  maxSponsoredPerPage: int(process.env.NEXT_PUBLIC_HIGHLIGHT_MAX_PER_PAGE, 2),
  slotPositions: [0, 5],
  maxExposuresPerVisitorPerDay: 3,
  maxAdvertiserShareOfRegion: 0.3,
};

export const whatsappLink = (text?: string) =>
  `https://wa.me/${COMPANY.whatsappE164.replace('+', '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
