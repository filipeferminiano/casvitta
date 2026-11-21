import { Breadcrumbs } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { CityIndexPage } from '@/lib/data/market';
import {
  cityListingsPath,
  priceM2Path,
  search,
  type NavHood,
  type Transaction,
} from '@/lib/site-nav';

/** /imoveis/{venda|aluguel}/sao-paulo: neighborhoods that pass the data threshold. */
export async function CityListingsScreen({
  transaction,
  hoods,
  index,
}: {
  transaction: Transaction;
  hoods: NavHood[];
  index: CityIndexPage | null;
}) {
  const t = await getTranslations('cityListings');
  const sale = transaction === 'sale';
  const sales = new Map(index?.neighborhoods.map((n) => [n.place.slug, n.stats?.sales ?? 0]));
  const title = t(sale ? 'titleSale' : 'titleRent');
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-6 pb-16 md:px-8 xl:px-20">
      <Breadcrumbs
        label={t('breadcrumbLabel')}
        items={[{ label: t('home'), href: '/' }, { label: title }]}
        renderLink={(href, children) => <Link href={href}>{children}</Link>}
      />
      <div>
        <h1 className="type-display-l">{title}</h1>
        <p className="mt-2 max-w-[65ch] type-body text-fg-strong">{t('intro')}</p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hoods.map((h) => (
          <li
            key={h.slug}
            className="flex flex-col gap-1 rounded-card border border-line bg-panel p-4"
          >
            <h2 className="type-title text-[18px]">{h.name}</h2>
            <p className="type-caption">{t('sales', { count: sales.get(h.slug) ?? 0 })}</p>
            <Link
              href={search(transaction, { where: h.name })}
              className="flex min-h-11 items-center type-body-s font-semibold text-action hover:underline"
            >
              {t('see', { where: h.inName })}
            </Link>
            <Link
              href={priceM2Path(h.slug)}
              className="flex min-h-8 items-center type-body-s text-action hover:underline"
            >
              {t('priceM2', { where: h.inName })}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-6">
        <Link
          href={search(transaction)}
          className="type-body-s font-semibold text-action underline underline-offset-2"
        >
          {t('searchAll')}
        </Link>
        <Link
          href={cityListingsPath(sale ? 'rent' : 'sale')}
          className="type-body-s font-semibold text-action underline underline-offset-2"
        >
          {t(sale ? 'switchToRent' : 'switchToSale')}
        </Link>
      </div>
    </div>
  );
}
