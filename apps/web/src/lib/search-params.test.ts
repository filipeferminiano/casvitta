import { describe, expect, it } from 'vitest';

import { filtersToQuery, parseFilters, searchPath, withFilters } from './search-params';

const parse = (query: string, transaction: 'sale' | 'rent' = 'sale') =>
  parseFilters(new URLSearchParams(query), transaction);

describe('search filters in the URL', () => {
  it('round-trips every filter', () => {
    const query =
      'onde=Vila+Mariana&tipo=apartamento&ate=750000&quartos=2&fgts=1&metro=1&pet=1&ordem=menor-preco&modo=investir';
    const filters = parse(query);
    expect(filters).toMatchObject({
      where: 'Vila Mariana',
      kind: 'apartment',
      maxPriceCents: 75_000_000,
      minBedrooms: 2,
      fgts: true,
      metro: true,
      pet: true,
      sort: 'price_asc',
      invest: true,
    });
    expect(parse(filtersToQuery(filters))).toEqual(filters);
  });

  it('ignores invalid values', () => {
    expect(parse('ate=abc&quartos=-1&tipo=castelo&ordem=x')).toMatchObject({
      maxPriceCents: null,
      minBedrooms: null,
      kind: null,
      sort: 'relevance',
    });
  });

  it('removing a chip drops only that filter', () => {
    const filters = parse('onde=Vila+Mariana&fgts=1');
    expect(withFilters(filters, { fgts: false })).toBe('/comprar?onde=Vila+Mariana');
    expect(searchPath({ ...filters, transaction: 'rent' })).toBe(
      '/alugar?onde=Vila+Mariana&fgts=1',
    );
  });
});
