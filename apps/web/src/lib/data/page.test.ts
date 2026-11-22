import { describe, expect, it } from 'vitest';

import { sourceFromSearch, whatsappHref } from './page';

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
