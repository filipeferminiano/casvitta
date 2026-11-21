'use client';

import { AudienceSwitch, Button, type AudienceSwitchItem } from '@casvitta/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * The three audience pages and where each page's header CTA points. The global header is being
 * redesigned separately, so everything audience-specific lives here; MarketplaceHeader only asks
 * `audienceFor(pathname)` and renders these pieces.
 */
export const AUDIENCE_PAGES = [
  { key: 'owners', href: '/anunciar-imovel', cta: '#comece' },
  { key: 'brokers', href: '/para-corretores', cta: '#plano' },
  { key: 'agencies', href: '/para-imobiliarias', cta: '#demonstracao' },
] as const;

export type AudienceKey = (typeof AUDIENCE_PAGES)[number]['key'];

/** Exact match: sub-pages such as /anunciar-imovel/corretor keep the regular header. */
export function audienceFor(pathname: string): AudienceKey | null {
  return AUDIENCE_PAGES.find((p) => p.href === pathname)?.key ?? null;
}

function useItems(current: AudienceKey): AudienceSwitchItem[] {
  const t = useTranslations('audience.switch');
  return AUDIENCE_PAGES.map((p) => ({
    key: p.key,
    href: p.href,
    label: t(`${p.key}.label`),
    shortLabel: t(`${p.key}.short`),
    current: p.key === current,
  }));
}

const renderLink: Parameters<typeof AudienceSwitch>[0]['renderLink'] = ({
  href,
  children,
  ...rest
}) => (
  <Link href={href} {...rest}>
    {children}
  </Link>
);

/** Desktop: the three pages as header nav items (aria-current on the open one). */
export function AudienceHeaderNav({ current }: { current: AudienceKey }) {
  const t = useTranslations('audience.switch');
  return (
    <AudienceSwitch
      variant="nav"
      label={t('label')}
      items={useItems(current)}
      renderLink={renderLink}
      className="hidden lg:block"
    />
  );
}

/** Desktop: the page's own call to action, in place of the global one. */
export function AudienceHeaderCta({ current }: { current: AudienceKey }) {
  const t = useTranslations('audience.switch');
  const page = AUDIENCE_PAGES.find((p) => p.key === current)!;
  return (
    <Button asChild size="sm">
      <a href={page.cta}>{t(`${current}.cta`)}</a>
    </Button>
  );
}

/** Phones: a 3-tab row under the header. */
export function AudienceTabs({ current }: { current: AudienceKey }) {
  const t = useTranslations('audience.switch');
  return (
    <AudienceSwitch
      variant="tabs"
      label={t('label')}
      items={useItems(current)}
      renderLink={renderLink}
      className="lg:hidden"
    />
  );
}
