/**
 * The SEO listing URLs /imoveis/{venda|aluguel}/{cidade}/{bairro} are canonical for a place
 * filter. /comprar and /alugar keep working as the search tool: with only `onde` matching one
 * neighborhood they redirect there; with more filters their canonical points there.
 */
import { getCityIndex } from '@/lib/data/market';

const CITY = 'sao-paulo';
/**
 * Redirect /comprar?onde=<bairro> to the SEO listing URL only once the SEO pages can show real
 * listings (the API has no listings domain yet). Until then the search keeps its results and
 * only its canonical points to the SEO URL.
 */
export const REDIRECT_SEARCH_TO_SEO = false;

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export async function seoListingsPath(
  transaction: 'sale' | 'rent',
  where: string | null | undefined,
): Promise<string | null> {
  const place = where?.split(',')[0];
  if (!place) return null;
  const index = await getCityIndex(CITY);
  const wanted = fold(place);
  const match = index?.neighborhoods.find((n) => fold(n.place.name) === wanted);
  if (!match) return null;
  return `/imoveis/${transaction === 'sale' ? 'venda' : 'aluguel'}/${CITY}/${match.place.slug}`;
}

/** Only the place filter is set (so the search page can redirect instead of canonicalizing). */
export function onlyPlaceFilter(params: URLSearchParams): boolean {
  return REDIRECT_SEARCH_TO_SEO && [...params.keys()].every((key) => key === 'onde');
}
