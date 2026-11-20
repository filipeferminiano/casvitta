import { beforeEach, describe, expect, it } from 'vitest';

import { isPublishable } from './data/ads';
import { db, mutate, resetDb } from './data/store';
import { buildLlmsTxt } from './llms';
import { AI_CRAWLERS, MARKETPLACE_PAGES, robotsFor, siteOrigin, sitemapFor } from './seo';

const ORIGIN = 'https://casvitta.com.br';
const LANDING = { kind: 'landing', brokerSlug: 'anaribeiro' } as const;
const LANDING_ORIGIN = 'https://anaribeiro.casvitta.com.br';

/** Turns the demo broker and their properties into real, verified records. */
const makeReal = () =>
  mutate((data) => {
    data.broker = { ...data.broker, isDemo: false, creciVerifiedAt: '2026-11-01T12:00:00Z' };
    data.properties = data.properties.map((p) => ({ ...p, isDemo: false }));
  });

const urls = (entries: { url: string }[]) => entries.map((e) => e.url);

beforeEach(() => resetDb());

describe('siteOrigin', () => {
  it('uses the broker subdomain on landing hosts', () => {
    expect(siteOrigin(LANDING, ORIGIN, 'casvitta.com.br')).toBe(LANDING_ORIGIN);
    expect(siteOrigin({ kind: 'marketplace' }, ORIGIN, 'casvitta.com.br')).toBe(ORIGIN);
  });
});

describe('sitemapFor', () => {
  it('lists only the static pages while every listing is demo (rule 7)', () => {
    expect(urls(sitemapFor({ kind: 'marketplace' }, ORIGIN))).toEqual(
      MARKETPLACE_PAGES.map(({ path }) => `${ORIGIN}${path}`),
    );
  });

  it('adds published listings of a verified broker, never unauthorized ones', () => {
    makeReal();
    const listed = urls(sitemapFor({ kind: 'marketplace' }, ORIGIN));
    for (const p of db().properties) {
      expect(listed.includes(`${ORIGIN}/imovel/${p.slug}`)).toBe(isPublishable(p));
    }
    expect(db().properties.some((p) => !isPublishable(p))).toBe(true);
  });

  it('keeps a broker without a verified CRECI out (rule 1)', () => {
    makeReal();
    mutate((data) => {
      data.broker = { ...data.broker, creciVerifiedAt: null };
    });
    expect(sitemapFor(LANDING, LANDING_ORIGIN)).toEqual([]);
    expect(urls(sitemapFor({ kind: 'marketplace' }, ORIGIN))).not.toContain(
      `${ORIGIN}/imovel/apto-vila-mariana`,
    );
  });

  it('lists the broker page and its property pages on the broker host', () => {
    expect(sitemapFor(LANDING, LANDING_ORIGIN)).toEqual([]);
    makeReal();
    const listed = urls(sitemapFor(LANDING, LANDING_ORIGIN));
    expect(listed[0]).toBe(LANDING_ORIGIN);
    expect(listed).toContain(`${LANDING_ORIGIN}/apto-vila-mariana`);
    expect(listed.every((u) => u.startsWith(LANDING_ORIGIN))).toBe(true);
  });

  it('is empty for an unknown broker and for the Broker OS host', () => {
    makeReal();
    expect(sitemapFor({ kind: 'landing', brokerSlug: 'ninguem' }, 'https://x')).toEqual([]);
    expect(sitemapFor({ kind: 'app' }, ORIGIN)).toEqual([]);
  });
});

describe('robotsFor', () => {
  it('blocks everything outside production and on the Broker OS host', () => {
    const blocked = { rules: { userAgent: '*', disallow: '/' } };
    expect(robotsFor({ kind: 'marketplace' }, ORIGIN, false)).toEqual(blocked);
    expect(robotsFor({ kind: 'app' }, ORIGIN, true)).toEqual(blocked);
  });

  it('allows search and AI crawlers with the same private paths blocked', () => {
    const robots = robotsFor({ kind: 'marketplace' }, ORIGIN, true);
    expect(robots.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    expect(rules.map((r) => r.userAgent)).toEqual([[...AI_CRAWLERS], '*']);
    for (const rule of rules) {
      expect(rule.allow).toBe('/');
      expect(rule.disallow).toEqual(expect.arrayContaining(['/cadastro', '/app/', '/entrar']));
    }
  });

  it('points a broker host to its own sitemap', () => {
    expect(robotsFor(LANDING, LANDING_ORIGIN, true).sitemap).toBe(`${LANDING_ORIGIN}/sitemap.xml`);
  });
});

describe('buildLlmsTxt', () => {
  it('renders the llmstxt.org layout with absolute links', () => {
    const txt = buildLlmsTxt(ORIGIN, {
      summary: 'Resumo',
      intro: 'Introdução',
      sections: [
        {
          title: 'Seção',
          links: [{ path: '/comprar', label: 'Comprar', description: 'à venda' }],
          notes: ['Nota'],
        },
      ],
    });
    expect(txt).toBe(
      '# Casvitta\n\n> Resumo\n\nIntrodução\n\n## Seção\n\n' +
        `- [Comprar](${ORIGIN}/comprar): à venda\n- Nota\n`,
    );
  });
});
