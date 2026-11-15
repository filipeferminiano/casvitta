/**
 * Search filters <-> URL (pt-BR keys, so links are readable and shareable):
 * /comprar?onde=Vila+Mariana&tipo=apartamento&ate=750000&quartos=2&fgts=1&metro=1&pet=1&ordem=menor-preco&modo=investir
 */
import type { PropertyKind, Transaction } from '@/domain/types';

export type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

export type SearchFilters = {
  transaction: Transaction;
  where: string | null;
  kind: PropertyKind | null;
  /** Integer cents. */
  maxPriceCents: number | null;
  minBedrooms: number | null;
  fgts: boolean;
  metro: boolean;
  pet: boolean;
  sort: SortKey;
  /** "Para investir": estimated rent and gross yield per card. */
  invest: boolean;
};

const KIND_PARAM: Record<PropertyKind, string> = {
  apartment: 'apartamento',
  house: 'casa',
  studio: 'studio',
};
const SORT_PARAM: Record<SortKey, string> = {
  relevance: 'relevantes',
  price_asc: 'menor-preco',
  price_desc: 'maior-preco',
  newest: 'recentes',
};

const invert = <K extends string>(map: Record<K, string>) =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<string, K>;
const KIND_FROM = invert(KIND_PARAM);
const SORT_FROM = invert(SORT_PARAM);

type ParamsLike = { get(key: string): string | null };

export function parseFilters(params: ParamsLike, transaction: Transaction): SearchFilters {
  const positive = (key: string) => {
    const n = Number(params.get(key));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };
  const maxReais = positive('ate');
  return {
    transaction,
    where: params.get('onde')?.trim() || null,
    kind: KIND_FROM[params.get('tipo') ?? ''] ?? null,
    maxPriceCents: maxReais ? maxReais * 100 : null,
    minBedrooms: positive('quartos'),
    fgts: params.get('fgts') === '1',
    metro: params.get('metro') === '1',
    pet: params.get('pet') === '1',
    sort: SORT_FROM[params.get('ordem') ?? ''] ?? 'relevance',
    invest: params.get('modo') === 'investir',
  };
}

export function filtersToQuery(filters: SearchFilters): string {
  const q = new URLSearchParams();
  if (filters.where) q.set('onde', filters.where);
  if (filters.kind) q.set('tipo', KIND_PARAM[filters.kind]);
  if (filters.maxPriceCents) q.set('ate', String(Math.round(filters.maxPriceCents / 100)));
  if (filters.minBedrooms) q.set('quartos', String(filters.minBedrooms));
  if (filters.fgts) q.set('fgts', '1');
  if (filters.metro) q.set('metro', '1');
  if (filters.pet) q.set('pet', '1');
  if (filters.sort !== 'relevance') q.set('ordem', SORT_PARAM[filters.sort]);
  if (filters.invest) q.set('modo', 'investir');
  return q.toString();
}

export const searchPath = (filters: SearchFilters) => {
  const query = filtersToQuery(filters);
  return `/${filters.transaction === 'rent' ? 'alugar' : 'comprar'}${query ? `?${query}` : ''}`;
};

export const withFilters = (filters: SearchFilters, patch: Partial<SearchFilters>) =>
  searchPath({ ...filters, ...patch });
