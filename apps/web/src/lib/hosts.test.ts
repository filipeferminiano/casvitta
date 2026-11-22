import { describe, expect, it } from 'vitest';

import { isCustomDomainCandidate, resolveSite, routeRequest } from './hosts.ts';

const ROOT = 'casvitta.com.br';

describe('resolveSite', () => {
  it.each([
    ['casvitta.com.br', { kind: 'marketplace' }],
    ['www.casvitta.com.br', { kind: 'marketplace' }],
    ['WWW.Casvitta.com.br.', { kind: 'marketplace' }],
    ['app.casvitta.com.br', { kind: 'app' }],
    ['anaribeiro.casvitta.com.br', { kind: 'landing', brokerSlug: 'anaribeiro' }],
    ['ana-ribeiro.casvitta.com.br', { kind: 'landing', brokerSlug: 'ana-ribeiro' }],
    ['api.casvitta.com.br', { kind: 'reserved' }],
    ['a.b.casvitta.com.br', { kind: 'reserved' }],
    ['-bad.casvitta.com.br', { kind: 'reserved' }],
    ['casvitta-preview.vercel.app', { kind: 'marketplace' }],
  ])('%s', (host, expected) => {
    expect(resolveSite(host, ROOT)).toEqual(expected);
  });

  it('works with a port in development', () => {
    expect(resolveSite('app.localhost:3000', 'localhost:3000')).toEqual({ kind: 'app' });
    expect(resolveSite('anaribeiro.localhost:3000', 'localhost:3000')).toEqual({
      kind: 'landing',
      brokerSlug: 'anaribeiro',
    });
    expect(resolveSite('localhost:3000', 'localhost:3000')).toEqual({ kind: 'marketplace' });
  });
});

describe('routeRequest', () => {
  it('rewrites the app host into /app', () => {
    expect(routeRequest({ kind: 'app' }, '/leads', ROOT)).toEqual({
      action: 'rewrite',
      pathname: '/app/leads',
    });
    expect(routeRequest({ kind: 'app' }, '/', ROOT)).toEqual({
      action: 'rewrite',
      pathname: '/app',
    });
  });

  it('rewrites broker hosts into /l/{slug}', () => {
    const site = { kind: 'landing', brokerSlug: 'anaribeiro' } as const;
    expect(routeRequest(site, '/', ROOT)).toEqual({ action: 'rewrite', pathname: '/l/anaribeiro' });
    expect(routeRequest(site, '/apto-vila-mariana', ROOT)).toEqual({
      action: 'rewrite',
      pathname: '/l/anaribeiro/apto-vila-mariana',
    });
  });

  it('never serves internal prefixes on the marketplace host', () => {
    expect(routeRequest({ kind: 'marketplace' }, '/app/leads', ROOT)).toEqual({
      action: 'redirect',
      host: 'app.casvitta.com.br',
      pathname: '/leads',
    });
    expect(routeRequest({ kind: 'marketplace' }, '/l/anaribeiro/apto', ROOT)).toEqual({
      action: 'redirect',
      host: 'anaribeiro.casvitta.com.br',
      pathname: '/apto',
    });
    expect(routeRequest({ kind: 'marketplace' }, '/l/../x', ROOT)).toEqual({ action: 'not-found' });
    expect(routeRequest({ kind: 'marketplace' }, '/apps-e-sites', ROOT)).toEqual({
      action: 'next',
    });
  });

  it('404s reserved subdomains', () => {
    expect(routeRequest({ kind: 'reserved' }, '/', ROOT)).toEqual({ action: 'not-found' });
  });

  it('serves the backoffice only on admin.{root}, from /bo', () => {
    expect(resolveSite('admin.casvitta.com.br', ROOT)).toEqual({ kind: 'backoffice' });
    expect(resolveSite('admin.localhost:3000', 'localhost:3000')).toEqual({ kind: 'backoffice' });
    const site = { kind: 'backoffice' } as const;
    expect(routeRequest(site, '/', ROOT)).toEqual({ action: 'rewrite', pathname: '/bo' });
    expect(routeRequest(site, '/creci', ROOT)).toEqual({
      action: 'rewrite',
      pathname: '/bo/creci',
    });
    // No hint of it on the public host.
    expect(routeRequest({ kind: 'marketplace' }, '/bo', ROOT)).toEqual({ action: 'not-found' });
    expect(routeRequest({ kind: 'marketplace' }, '/bo/equipe', ROOT)).toEqual({
      action: 'not-found',
    });
  });
});

describe('isCustomDomainCandidate', () => {
  it('looks up only hosts that are not ours, previews or IPs', () => {
    const root = 'casvitta.com.br';
    expect(isCustomDomainCandidate('www.marianaimoveis.com.br', root)).toBe(true);
    expect(isCustomDomainCandidate('WWW.Mariana.com.br.', root)).toBe(true);
    for (const host of [
      'casvitta.com.br',
      'www.casvitta.com.br',
      'mariana.casvitta.com.br',
      'casvitta-web-abc.a.run.app',
      '10.0.0.1:8080',
      'localhost:3000',
      'mariana.localhost:3000',
    ]) {
      expect(isCustomDomainCandidate(host, root)).toBe(false);
    }
    expect(isCustomDomainCandidate('www.mariana.test:3000', 'localhost:3000')).toBe(true);
  });
});
