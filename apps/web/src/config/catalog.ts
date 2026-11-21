/**
 * The plan catalog (CRM-0): one source, the API's app/core/catalog.py, exported to
 * packages/config/catalog.json by `make catalog:gen` and read here at build time. Landing pages,
 * the prices page, signup and llms.txt read plans, limits, features, add-ons and packages from
 * this module only. Prices are hypotheses (nov/2026), never a promotion, discount or trial.
 */
import snapshot from '@casvitta/config/catalog.json';
import type { components } from '@casvitta/api-client';

export type Catalog = components['schemas']['CatalogOut'];
export type CatalogPlan = components['schemas']['PlanOut'];
/** Plan keys sold today plus the legacy ones that stay valid on existing workspaces. */
export type WorkspacePlan = CatalogPlan['key'];
export type PlanKey = 'free' | 'essential' | 'automation' | 'pro' | 'agency';
export type Feature = components['schemas']['Feature'];
export type Meter = components['schemas']['Meter'];
export type AddOn = components['schemas']['AddOnOut'];

export const CATALOG = snapshot as Catalog;

/** Plans sold today, in ladder order (Grátis → Imobiliária). */
export const PLANS: CatalogPlan[] = CATALOG.plans;
export const PAID_PLANS = PLANS.filter((p) => p.monthly_cents > 0);

export const isPlanKey = (value: string | null | undefined): value is PlanKey =>
  PLANS.some((p) => p.key === value);

export function planOf(key: PlanKey): CatalogPlan {
  const plan = PLANS.find((p) => p.key === key);
  if (!plan) throw new Error(`Unknown plan ${key}`);
  return plan;
}

export const hasFeature = (key: PlanKey, feature: Feature) =>
  planOf(key).features.includes(feature);

/** null = ilimitado; 0 = não incluso. */
export const limitOf = (key: PlanKey, meter: Meter) => planOf(key).limits[meter] ?? null;

/** Annual per-month price, only when the owner turned annual prices on. */
export const annualPrice = (plan: CatalogPlan) =>
  CATALOG.show_annual_prices ? (plan.annual_monthly_cents ?? null) : null;

/** First plan (in ladder order) that includes a feature, for contextual upgrades. */
export const firstPlanWith = (feature: Feature) =>
  PLANS.find((p) => p.features.includes(feature)) ?? null;
