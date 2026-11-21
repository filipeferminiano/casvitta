'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { track } from '@/lib/analytics';

/** "marketplace" | "app" | "landing", from the host (see lib/hosts.ts). */
function siteOf(host: string): string {
  const sub = host.split('.')[0] ?? '';
  if (host.split('.').length <= 1 || ['www', 'localhost', 'casvitta'].includes(sub)) {
    return 'marketplace';
  }
  return sub === 'app' ? 'app' : 'landing';
}

function isBackoffice(): boolean {
  return window.location.hostname.startsWith('admin.');
}

/**
 * - `page_view` on every client navigation (the GA4 tag in GTM must not send its own).
 * - `whatsapp_click` for any wa.me link.
 * - Declarative clicks: `data-track="select_plan" data-track-plan="essencial"` pushes
 *   `{ event: 'select_plan', plan: 'essencial' }`, so server components can track clicks.
 */
export function AnalyticsListener() {
  const pathname = usePathname();

  useEffect(() => {
    if (isBackoffice()) return; // staff pages are never tracked
    // Query strings can carry search filters but never PII (see lib/search-params.ts).
    const site = siteOf(window.location.hostname);
    track({
      name: 'page_view',
      page_path: window.location.pathname + window.location.search,
      page_location: window.location.href,
      // Broker OS titles can name leads (people): never send them.
      page_title: site === 'app' ? '' : document.title,
      site,
    });
  }, [pathname]);

  useEffect(() => {
    if (isBackoffice()) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const tagged = target?.closest<HTMLElement>('[data-track]');
      if (tagged) {
        const params: Record<string, string> = {};
        for (const [key, value] of Object.entries(tagged.dataset)) {
          if (key.startsWith('track') && key !== 'track' && value !== undefined) {
            const name = key
              .slice(5)
              .replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
              .replace(/^_/, '');
            params[name] = value;
          }
        }
        track({ name: tagged.dataset.track ?? 'click', ...params });
      }
      const link = target?.closest<HTMLAnchorElement>('a[href*="wa.me/"]');
      if (link) track({ name: 'whatsapp_click', location: window.location.pathname });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
