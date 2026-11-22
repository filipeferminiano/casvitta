import { describe, expect, it } from 'vitest';

import { movedTo, sourceFromSearch, whatsappHref, type PublicPage } from './page';

describe('broker page helpers', () => {
  it('reads where the visit came from', () => {
    expect(sourceFromSearch(new URLSearchParams('origem=qr'))).toBe('qr');
    expect(sourceFromSearch(new URLSearchParams('utm_source=instagram'))).toBe('campaign');
    expect(sourceFromSearch(new URLSearchParams(''))).toBe('link');
  });

  it('builds a wa.me link with digits only and an encoded message', () => {
    expect(whatsappHref('+5519998765432', 'Olá, Mariana! CV-12')).toBe(
      'https://wa.me/5519998765432?text=Ol%C3%A1%2C%20Mariana!%20CV-12',
    );
  });
});

describe('movedTo', () => {
  const page = { slug: 'mariana-campinas', url: 'https://mariana-campinas.casvitta.com.br' };
  const host = 'mariana-campinas.casvitta.com.br';
  it('keeps path and query when an old address is used', () => {
    expect(
      movedTo(page as PublicPage, 'marianaalves', 'marianaalves.casvitta.com.br', '/cv-204', {
        origem: 'qr',
        utm_source: ['ig'],
      }),
    ).toBe('https://mariana-campinas.casvitta.com.br/cv-204?origem=qr&utm_source=ig');
  });
  it('does nothing on the current address', () => {
    expect(movedTo(page as PublicPage, 'Mariana-Campinas', host, '', {})).toBeNull();
  });
  it('sends the subdomain to the active custom domain, and serves the domain itself', () => {
    const withDomain = { ...page, url: 'https://www.marianaimoveis.com.br' } as PublicPage;
    expect(movedTo(withDomain, 'mariana-campinas', host, '/x', {})).toBe(
      'https://www.marianaimoveis.com.br/x',
    );
    expect(movedTo(withDomain, 'mariana-campinas', 'www.marianaimoveis.com.br', '', {})).toBeNull();
  });
});
