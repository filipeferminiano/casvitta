import { afterEach, describe, expect, it, vi } from 'vitest';

import { setAnalyticsAdapter, setAnalyticsConsent, track } from './analytics';

afterEach(() => window.localStorage.clear());

describe('track()', () => {
  it('sends nothing without analytics consent', () => {
    const send = vi.fn();
    setAnalyticsAdapter({ send });
    expect(track({ name: 'page_view', path: '/' })).toBe(false);
    setAnalyticsConsent(false);
    expect(track({ name: 'form_submit', form: 'auction' })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('forwards events once consent is granted', () => {
    const send = vi.fn();
    setAnalyticsAdapter({ send });
    setAnalyticsConsent(true);
    expect(track({ name: 'signup_step', step: 'creci' })).toBe(true);
    expect(send).toHaveBeenCalledWith({ name: 'signup_step', step: 'creci' });
  });
});
