'use client';

import { cn } from '@casvitta/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ITEMS = [
  { href: '/comprar', key: 'buy', match: ['/comprar', '/imovel'] },
  { href: '/alugar', key: 'rent', match: ['/alugar'] },
  { href: '/favoritos', key: 'favorites', match: ['/favoritos'] },
  { href: '/minhas-visitas', key: 'visits', match: ['/minhas-visitas'] },
] as const;

export function MarketplaceNav() {
  const t = useTranslations('marketplace.nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('label')} className="hidden md:block">
      <ul className="flex gap-1">
        {ITEMS.map((item) => {
          const current = item.match.some((m) => pathname.startsWith(m));
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-control px-3 type-body-s font-semibold text-fg-strong hover:bg-subtle',
                  current && 'bg-action-subtle text-fg',
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
