'use client';

import { Button, cn, Logo } from '@casvitta/ui';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { COMPANY, whatsappLink } from '@/config/site';
import { formatPhoneIntl } from '@/lib/format';

const ITEMS = [
  { href: '/comprar', key: 'buy', match: ['/comprar', '/imovel'] },
  { href: '/alugar', key: 'rent', match: ['/alugar'] },
  { href: '/anunciar-imovel', key: 'list', match: ['/anunciar-imovel'] },
  { href: '/para-corretores', key: 'brokers', match: ['/para-corretores'] },
] as const;

/** Focused flows (signup, auction capture) get a minimal header (mockups 55, 59). */
const MINIMAL = ['/cadastro', '/leilao'];

/** Public-site header (mockups 51, 52, 53). */
export function MarketplaceHeader() {
  const t = useTranslations('marketplace.nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const minimal = MINIMAL.some((p) => pathname.startsWith(p));
  const phone = formatPhoneIntl(COMPANY.whatsappE164);

  return (
    <header className="relative border-b border-line bg-panel">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:h-16 md:px-8 xl:px-20">
        <Link href="/" aria-label={tCommon('homeLink')} className="shrink-0 rounded-control">
          <Logo height={20} title={null} />
        </Link>
        {minimal ? (
          <a
            href={whatsappLink()}
            className="ml-auto flex min-h-11 items-center type-body-s text-fg-strong hover:underline"
          >
            <span className="md:hidden">{t('questionsShort')}</span>
            <span className="hidden md:inline">{t('questions', { phone })}</span>
          </a>
        ) : (
          <>
            <nav aria-label={t('label')} className="hidden lg:block">
              <ul className="flex gap-1">
                {ITEMS.map((item) => {
                  const current = item.match.some((m) => pathname.startsWith(m));
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center rounded-control px-3 type-body-s font-medium text-fg hover:bg-subtle',
                          current && 'bg-action-subtle font-semibold',
                        )}
                      >
                        {t(item.key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="ml-auto hidden items-center gap-4 lg:flex">
              <Link href="/entrar" className="type-body-s font-medium text-fg hover:underline">
                {t('signIn')}
              </Link>
              <Button asChild size="sm">
                <Link href="/cadastro/conta">{t('startAsBroker')}</Link>
              </Button>
            </div>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? t('closeMenu') : t('openMenu')}
              onClick={() => setOpenOn(open ? null : pathname)}
              className="ml-auto flex size-11 items-center justify-center rounded-control lg:hidden"
            >
              {open ? (
                <X aria-hidden="true" strokeWidth={1.6} />
              ) : (
                <Menu aria-hidden="true" strokeWidth={1.6} />
              )}
            </button>
          </>
        )}
      </div>
      {!minimal && open ? (
        <nav
          id="site-menu"
          aria-label={t('label')}
          className="border-t border-line bg-panel px-4 pb-4 lg:hidden"
        >
          <ul className="flex flex-col">
            {ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex min-h-12 items-center border-b border-line type-body font-medium"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/entrar"
                className="flex min-h-12 items-center border-b border-line type-body font-medium"
              >
                {t('signIn')}
              </Link>
            </li>
          </ul>
          <Button asChild className="mt-4 w-full">
            <Link href="/cadastro/conta">{t('startAsBroker')}</Link>
          </Button>
        </nav>
      ) : null}
    </header>
  );
}
