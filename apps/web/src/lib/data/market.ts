/**
 * Public price pages (ITBI). Server-side reads: from the API when the 'market' area is live
 * (lib/live.ts), cached with the MARKET_TAG tag and revalidated after each data refresh; otherwise
 * from the fabricated demo export (mocks/market-demo.json, flagged is_demo).
 *
 * Every number arrives already gated and rounded by the API (apps/api gates.py): pages never
 * compute medians or show a group below its threshold.
 */
import type { components } from '@casvitta/api-client';

import { API_INTERNAL_URL } from '@/lib/api';
import { isLive } from '@/lib/live';
import demo from '@/mocks/market-demo.json';

type Schemas = components['schemas'];
export type CityIndexPage = Schemas['CityIndexPage'];
export type NeighborhoodPage = Schemas['NeighborhoodPage'];
export type StreetPage = Schemas['StreetPage'];
export type BuildingPage = Schemas['BuildingPage'];
export type FinancingPage = Schemas['FinancingPage'];
export type Redirect = Schemas['Redirect'];
export type PublicStats = Schemas['PublicStats'];
export type SourceInfo = Schemas['SourceInfo'];
export type GateInfo = Schemas['GateInfo'];
export type PlaceRef = Schemas['PlaceRef'];
export type NeighborhoodRow = Schemas['NeighborhoodRow'];
export type StreetRow = Schemas['StreetRow'];
export type BuildingRow = Schemas['BuildingRow'];
export type Sitemap = Schemas['Sitemap'];
export type SitemapTemplate = Sitemap['template'];

/** Cities with price pages. Adding one is configuration plus an ingestion run. */
export const MARKET_CITIES = ['sao-paulo'] as const;
export const MARKET_TAG = 'market';
/** Pages re-render at most daily; a refresh revalidates MARKET_TAG right away. */
export const MARKET_REVALIDATE_SECONDS = 86_400;
export const SITEMAP_TEMPLATES: SitemapTemplate[] = [
  'bairros',
  'ruas',
  'condominios',
  'financiamento',
];

const USE_API = isLive('market');
const DEMO = demo as unknown as Record<string, unknown>;

export function isMarketCity(city: string): boolean {
  return (MARKET_CITIES as readonly string[]).includes(city);
}

export function isRedirect(value: object): value is Redirect {
  return 'kind' in value && (value as { kind: string }).kind === 'redirect';
}

/** `path` relative to /v1/public/market. Null on 404. */
async function read<T>(path: string): Promise<T | null> {
  if (!USE_API) {
    // Demo keys drop the "/neighborhoods" segment: "sao-paulo/vila-mariana/streets/…".
    return (DEMO[path.replace('/neighborhoods/', '/')] as T | undefined) ?? null;
  }
  const response = await fetch(`${API_INTERNAL_URL}/v1/public/market/${path}`, {
    next: { tags: [MARKET_TAG], revalidate: MARKET_REVALIDATE_SECONDS },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`market API ${response.status} for ${path}`);
  return (await response.json()) as T;
}

const seg = encodeURIComponent;

export function getCityIndex(city: string) {
  return isMarketCity(city) ? read<CityIndexPage>(seg(city)) : Promise.resolve(null);
}

export function getNeighborhood(city: string, neighborhood: string) {
  if (!isMarketCity(city)) return Promise.resolve(null);
  return read<NeighborhoodPage | Redirect>(`${seg(city)}/neighborhoods/${seg(neighborhood)}`);
}

export function getStreet(city: string, neighborhood: string, street: string) {
  if (!isMarketCity(city)) return Promise.resolve(null);
  return read<StreetPage | Redirect>(
    `${seg(city)}/neighborhoods/${seg(neighborhood)}/streets/${seg(street)}`,
  );
}

export function getBuilding(city: string, neighborhood: string, building: string) {
  if (!isMarketCity(city)) return Promise.resolve(null);
  return read<BuildingPage | Redirect>(
    `${seg(city)}/neighborhoods/${seg(neighborhood)}/buildings/${seg(building)}`,
  );
}

export function getFinancing(city: string, neighborhood: string) {
  if (!isMarketCity(city)) return Promise.resolve(null);
  return read<FinancingPage | Redirect>(
    `${seg(city)}/neighborhoods/${seg(neighborhood)}/financing`,
  );
}

export function getSitemap(city: string, template: SitemapTemplate) {
  if (!isMarketCity(city)) return Promise.resolve(null);
  return read<Sitemap>(`${seg(city)}/sitemaps/${template}`);
}
