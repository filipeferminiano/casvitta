/**
 * Host-based routing.
 *
 *   casvitta.com.br, www.casvitta.com.br  -> marketplace, (marketplace) route group
 *   app.casvitta.com.br                   -> Broker OS,   (app) group, served from /app/*
 *   {brokerSlug}.casvitta.com.br          -> landing,     (landing) group, served from /l/{slug}/*
 *   admin.casvitta.com.br                 -> backoffice,  (backoffice) group, served from /bo/*
 *
 * In development ROOT_DOMAIN is "localhost:3000", so use app.localhost:3000 and
 * anaribeiro.localhost:3000 and admin.localhost:3000 (browsers resolve *.localhost to 127.0.0.1).
 */

export type Site =
  | { kind: 'marketplace' }
  | { kind: 'app' }
  | { kind: 'backoffice' }
  | { kind: 'landing'; brokerSlug: string }
  | { kind: 'reserved' };

export const APP_PREFIX = '/app';
export const LANDING_PREFIX = '/l';
export const BACKOFFICE_PREFIX = '/bo';
export const BACKOFFICE_SUBDOMAIN = 'admin';

const RESERVED_SUBDOMAINS = new Set([
  'api',
  'admin',
  'static',
  'cdn',
  'mail',
  'email',
  'status',
  'docs',
  'blog',
]);
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function resolveSite(host: string, rootDomain: string, appSubdomain = 'app'): Site {
  const normalizedHost = host.trim().toLowerCase().replace(/\.$/, '');
  const root = rootDomain.trim().toLowerCase();
  if (normalizedHost === root || normalizedHost === `www.${root}`) return { kind: 'marketplace' };
  if (!normalizedHost.endsWith(`.${root}`)) return { kind: 'marketplace' }; // previews, IPs
  const subdomain = normalizedHost.slice(0, -(root.length + 1));
  if (subdomain === appSubdomain) return { kind: 'app' };
  if (subdomain === BACKOFFICE_SUBDOMAIN) return { kind: 'backoffice' };
  if (RESERVED_SUBDOMAINS.has(subdomain) || !SLUG.test(subdomain)) return { kind: 'reserved' };
  return { kind: 'landing', brokerSlug: subdomain };
}

export type RouteDecision =
  | { action: 'next' }
  | { action: 'rewrite'; pathname: string }
  | { action: 'redirect'; host: string; pathname: string }
  | { action: 'not-found' };

/** Maps the visible URL to the internal route, and keeps each surface on its own host. */
export function routeRequest(
  site: Site,
  pathname: string,
  rootDomain: string,
  appSubdomain = 'app',
): RouteDecision {
  switch (site.kind) {
    case 'reserved':
      return { action: 'not-found' };
    case 'app':
      return { action: 'rewrite', pathname: `${APP_PREFIX}${pathname === '/' ? '' : pathname}` };
    case 'backoffice':
      return {
        action: 'rewrite',
        pathname: `${BACKOFFICE_PREFIX}${pathname === '/' ? '' : pathname}`,
      };
    case 'landing':
      return {
        action: 'rewrite',
        pathname: `${LANDING_PREFIX}/${site.brokerSlug}${pathname === '/' ? '' : pathname}`,
      };
    case 'marketplace': {
      // Internal prefixes are never served from the marketplace host: send them to their host.
      if (pathname === APP_PREFIX || pathname.startsWith(`${APP_PREFIX}/`)) {
        const rest = pathname.slice(APP_PREFIX.length) || '/';
        return { action: 'redirect', host: `${appSubdomain}.${rootDomain}`, pathname: rest };
      }
      // The backoffice is never served from the marketplace host, and gives no hint it exists.
      if (pathname === BACKOFFICE_PREFIX || pathname.startsWith(`${BACKOFFICE_PREFIX}/`)) {
        return { action: 'not-found' };
      }
      if (pathname.startsWith(`${LANDING_PREFIX}/`)) {
        const [, , slug, ...rest] = pathname.split('/');
        if (slug && SLUG.test(slug)) {
          return {
            action: 'redirect',
            host: `${slug}.${rootDomain}`,
            pathname: `/${rest.join('/')}`,
          };
        }
        return { action: 'not-found' };
      }
      return { action: 'next' };
    }
  }
}
