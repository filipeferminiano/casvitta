/**
 * Public-site navigation tree (docs/mockups/navigation): header menus, mobile menu, home link
 * blocks and /mapa-do-site all read this one model. Neighborhoods come from the market data
 * (only those that pass the publication threshold), never from a hard-coded list.
 */
import type { CityIndexPage } from '@/lib/data/market';
import { searchPath, type SearchFilters } from '@/lib/search-params';

export const NAV_CITY = 'sao-paulo';
export const SITE_MAP_PATH = '/mapa-do-site';

export type NavHood = { slug: string; name: string; inName: string };

/** Indexable neighborhoods, most sales first. */
export function navHoods(index: CityIndexPage | null | undefined): NavHood[] {
  if (!index) return [];
  return index.neighborhoods
    .filter((n) => n.indexable)
    .sort((a, b) => (b.stats?.sales ?? 0) - (a.stats?.sales ?? 0))
    .map((n) => ({
      slug: n.place.slug,
      name: n.place.name,
      inName: n.place.in_name ?? n.place.name,
    }));
}

export type Transaction = 'sale' | 'rent';

const BASE: SearchFilters = {
  transaction: 'sale',
  where: null,
  kind: null,
  maxPriceCents: null,
  minBedrooms: null,
  fgts: false,
  metro: false,
  pet: false,
  sort: 'relevance',
  invest: false,
};

/** The search tool, filtered. Its canonical points at the SEO listing URL when there is one. */
export const search = (transaction: Transaction, patch: Partial<SearchFilters> = {}) =>
  searchPath({ ...BASE, ...patch, transaction });

export const cityListingsPath = (transaction: Transaction) =>
  `/imoveis/${transaction === 'sale' ? 'venda' : 'aluguel'}/${NAV_CITY}`;

export const TOOL_PATHS = {
  valuation: '/quanto-vale-meu-imovel',
  itbi: `/itbi/${NAV_CITY}`,
  /** Per neighborhood only; the site map lists them all. */
  income: `${SITE_MAP_PATH}#quanto-preciso-ganhar`,
  priceM2: `/preco-m2/${NAV_CITY}`,
  byAddress: `${SITE_MAP_PATH}#por-endereco`,
} as const;

export const priceM2Path = (slug: string) => `/preco-m2/${NAV_CITY}/${slug}`;
export const valuationPath = (slug: string) => `/quanto-vale-meu-imovel/${NAV_CITY}/${slug}`;
export const incomePath = (slug: string) => `/financiamento/${NAV_CITY}/${slug}`;

/**
 * A link's label is a message key under `marketplace.menus.links` (with values), or a place
 * name taken from the data.
 */
export type NavLink = {
  id: string;
  href: string;
  label: { key: string; values?: Record<string, string> } | { text: string };
  soon?: boolean;
  more?: boolean;
};
export type NavSection = { key: string; links: NavLink[] };
export type NavMenu = { key: 'buy' | 'rent' | 'sell' | 'tools' | 'pros'; sections: NavSection[] };

const MENU_HOODS = 6;
const key = (k: string, values?: Record<string, string>): NavLink['label'] => ({ key: k, values });

function hoodLinks(hoods: NavHood[], href: (h: NavHood) => string, more: string): NavLink[] {
  return [
    ...hoods
      .slice(0, MENU_HOODS)
      .map((h) => ({ id: h.slug, href: href(h), label: { text: h.name } })),
    { id: 'allHoods', href: more, label: key('allHoods'), more: true },
  ];
}

export function buildMenus(hoods: NavHood[]): NavMenu[] {
  const byHood = (t: Transaction): NavSection[] =>
    hoods.length
      ? [
          {
            key: 'byHood',
            links: hoodLinks(hoods, (h) => search(t, { where: h.name }), cityListingsPath(t)),
          },
        ]
      : [];
  const byType = (t: Transaction): NavSection => ({
    key: 'byType',
    links: [
      { id: 'apartments', href: search(t, { kind: 'apartment' }), label: key(`${t}.apartments`) },
      { id: 'houses', href: search(t, { kind: 'house' }), label: key(`${t}.houses`) },
      { id: 'all', href: search(t), label: key(`${t}.all`) },
    ],
  });
  return [
    {
      key: 'buy',
      sections: [
        byType('sale'),
        ...byHood('sale'),
        {
          key: 'beforeBuying',
          links: [
            { id: 'income', href: TOOL_PATHS.income, label: key('income') },
            { id: 'itbi', href: TOOL_PATHS.itbi, label: key('itbi') },
            { id: 'priceM2', href: TOOL_PATHS.priceM2, label: key('hoodPriceM2') },
          ],
        },
      ],
    },
    {
      key: 'rent',
      sections: [
        byType('rent'),
        ...byHood('rent'),
        {
          key: 'beforeRenting',
          links: [
            { id: 'income', href: TOOL_PATHS.income, label: key('income') },
            { id: 'priceM2', href: TOOL_PATHS.priceM2, label: key('hoodPriceM2') },
          ],
        },
      ],
    },
    {
      key: 'sell',
      sections: [
        {
          key: 'yourProperty',
          links: [
            { id: 'list', href: '/anunciar-imovel', label: key('listMine') },
            { id: 'valuation', href: TOOL_PATHS.valuation, label: key('valuation') },
            { id: 'street', href: TOOL_PATHS.byAddress, label: key('streetPrice') },
            { id: 'building', href: TOOL_PATHS.byAddress, label: key('buildingPrice') },
          ],
        },
        {
          key: 'saleCosts',
          links: [{ id: 'itbi', href: TOOL_PATHS.itbi, label: key('itbiBuyerPays') }],
        },
      ],
    },
    {
      key: 'tools',
      sections: [
        {
          key: 'calculators',
          links: [
            { id: 'valuation', href: TOOL_PATHS.valuation, label: key('valuation') },
            { id: 'itbi', href: TOOL_PATHS.itbi, label: key('itbi') },
            { id: 'income', href: TOOL_PATHS.income, label: key('income') },
          ],
        },
        {
          key: 'priceM2',
          links: [
            { id: 'city', href: TOOL_PATHS.priceM2, label: key('cityPriceM2') },
            ...(hoods.length
              ? hoodLinks(
                  hoods.slice(0, MENU_HOODS - 1),
                  (h) => priceM2Path(h.slug),
                  TOOL_PATHS.priceM2,
                )
              : []),
          ],
        },
        {
          key: 'byAddress',
          links: [
            { id: 'street', href: TOOL_PATHS.byAddress, label: key('streetPrice') },
            { id: 'building', href: TOOL_PATHS.byAddress, label: key('buildingPrice') },
            { id: 'siteMap', href: SITE_MAP_PATH, label: key('siteMap'), more: true },
          ],
        },
      ],
    },
    {
      key: 'pros',
      sections: [
        {
          key: 'forBrokers',
          links: [{ id: 'brokers', href: '/para-corretores', label: key('brokerPlans') }],
        },
        {
          key: 'forCompanies',
          links: [
            { id: 'agencies', href: '/para-imobiliarias', label: key('agencies') },
            { id: 'developers', href: '/incorporadoras', label: key('developers'), soon: true },
            { id: 'investors', href: '/investidores', label: key('investors') },
          ],
        },
        {
          key: 'customers',
          links: [{ id: 'signIn', href: '/entrar', label: key('signIn') }],
        },
      ],
    },
  ];
}

/** Home "Buscas populares": filter × neighborhood combinations, sale and rent. */
export function popularSearches(hoods: NavHood[]): NavLink[] {
  const patterns: { id: string; t: Transaction; patch: Partial<SearchFilters>; label: string }[] = [
    {
      id: 'twoBedrooms',
      t: 'sale',
      patch: { kind: 'apartment', minBedrooms: 2 },
      label: 'popular.twoBedrooms',
    },
    { id: 'fgts', t: 'sale', patch: { fgts: true }, label: 'popular.fgts' },
    { id: 'metro', t: 'sale', patch: { metro: true }, label: 'popular.metro' },
    { id: 'pet', t: 'rent', patch: { pet: true }, label: 'popular.pet' },
    {
      id: 'rentApartments',
      t: 'rent',
      patch: { kind: 'apartment' },
      label: 'popular.rentApartments',
    },
    { id: 'houses', t: 'sale', patch: { kind: 'house' }, label: 'popular.houses' },
  ];
  const top = hoods.slice(0, 6);
  // Each neighborhood gets two different patterns, rotated so the list mixes them.
  return top.flatMap((h, i) =>
    [patterns[i % patterns.length]!, patterns[(i + 2) % patterns.length]!].map((p) => ({
      id: `${p.id}-${h.slug}`,
      href: search(p.t, { ...p.patch, where: h.name }),
      label: key(p.label, { where: h.inName }),
    })),
  );
}
