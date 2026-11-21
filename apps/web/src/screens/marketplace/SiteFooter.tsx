import { Logo } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { COMPANY, whatsappLink } from '@/config/site';
import { formatPhoneIntl } from '@/lib/format';

const COLUMNS = [
  {
    key: 'forYou',
    links: [
      { key: 'buy', href: '/comprar' },
      { key: 'rent', href: '/alugar' },
      { key: 'listMine', href: '/anunciar-imovel' },
      { key: 'simulate', href: '/#simulador' },
      { key: 'auctions', href: '/leilao' },
    ],
  },
  {
    key: 'forPros',
    links: [
      { key: 'brokers', href: '/para-corretores' },
      { key: 'agencies', href: '/para-imobiliarias' },
      { key: 'developers', href: '/incorporadoras' },
      { key: 'investors', href: '/investidores' },
    ],
  },
  {
    key: 'casvitta',
    links: [
      { key: 'about', href: '/sobre' },
      { key: 'privacy', href: '/privacidade' },
      { key: 'terms', href: '/termos' },
      { key: 'contact', href: whatsappLink() },
    ],
  },
] as const;

/** Shared public-site footer (mockups 51, 54–59). */
export async function SiteFooter() {
  const t = await getTranslations('marketplace.footer');
  const phone = formatPhoneIntl(COMPANY.whatsappE164);
  return (
    <footer className="bg-fg text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr] xl:px-20">
        <div className="flex flex-col gap-3">
          <Logo tone="white" height={20} title={null} />
          <p className="max-w-[36ch] type-body-s text-ink-300">{t('tagline')}</p>
          <a href={whatsappLink()} className="type-body-s font-semibold hover:underline">
            {t('whatsapp', { phone })}
          </a>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.key} aria-label={t(`columns.${column.key}.title`)}>
            <h2 className="mb-3 font-mono text-[12px] tracking-[0.08em] text-ink-300 uppercase">
              {t(`columns.${column.key}.title`)}
            </h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.key}>
                  <Link href={link.href} className="type-body-s hover:underline">
                    {t(`columns.${column.key}.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-7xl border-t border-ink-700 px-4 py-5 type-caption text-ink-300 md:px-8 xl:px-20">
        {t('legal', { creci: COMPANY.creci })}
      </p>
    </footer>
  );
}
