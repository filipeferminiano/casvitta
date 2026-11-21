import { Tabs, TabsContent, TabsList, TabsTrigger } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import {
  cityListingsPath,
  popularSearches,
  priceM2Path,
  search,
  valuationPath,
  type NavHood,
  type Transaction,
} from '@/lib/site-nav';

const CARD_HOODS = 7;

/**
 * Home link blocks (docs/mockups/navigation/home-blocks): neighborhoods with Comprar/Alugar tabs
 * and popular searches. Both tabs are in the HTML (forceMount) so crawlers see every link.
 */
export async function HomeLinkBlocks({ hoods }: { hoods: NavHood[] }) {
  if (!hoods.length) return null;
  const t = await getTranslations('home.links');
  const tMenus = await getTranslations('marketplace.menus.links');
  const shown = hoods.slice(0, CARD_HOODS);

  const card = (h: NavHood, tx: Transaction) => {
    const p = tx === 'sale' ? 'sale' : 'rent';
    const links = [
      {
        id: 'apartments',
        href: search(tx, { kind: 'apartment', where: h.name }),
        label: t(`card.${p}Apartments`, { where: h.inName }),
      },
      {
        id: 'houses',
        href: search(tx, { kind: 'house', where: h.name }),
        label: t(`card.${p}Houses`, { where: h.inName }),
      },
      { id: 'priceM2', href: priceM2Path(h.slug), label: t('card.priceM2', { where: h.inName }) },
      {
        id: 'valuation',
        href: valuationPath(h.slug),
        label: t('card.valuation', { where: h.inName }),
      },
    ];
    return (
      <li key={h.slug} className="flex flex-col gap-1 rounded-card border border-line bg-panel p-4">
        <Link
          href={search(tx, { where: h.name })}
          className="type-title text-[18px] text-fg hover:underline"
        >
          {h.name}
        </Link>
        <ul>
          {links.map((l) => (
            <li key={l.id}>
              <Link
                href={l.href}
                className="flex min-h-8 items-center type-body-s text-action hover:underline"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <>
      <section
        aria-labelledby="hoods-title"
        className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-14 md:px-8 xl:px-20"
      >
        <Tabs defaultValue="sale" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="hoods-title" className="type-title">
                {t('hoodsTitle')}
              </h2>
              <p className="type-body-s text-fg-muted">{t('hoodsSubtitle')}</p>
            </div>
            <TabsList aria-label={t('hoodsTitle')}>
              <TabsTrigger value="sale">{t('tabs.sale')}</TabsTrigger>
              <TabsTrigger value="rent">{t('tabs.rent')}</TabsTrigger>
            </TabsList>
          </div>
          {(['sale', 'rent'] as const).map((tx) => (
            <TabsContent key={tx} value={tx} forceMount className="data-[state=inactive]:hidden">
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {shown.map((h) => card(h, tx))}
                <li>
                  <Link
                    href={cityListingsPath(tx)}
                    className="flex h-full min-h-14 items-center justify-center rounded-card border border-dashed border-ink-300 p-4 type-body-s font-semibold text-action hover:underline"
                  >
                    {t('allHoods')}
                    <span aria-hidden="true" className="ml-1">
                      ›
                    </span>
                  </Link>
                </li>
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <nav
        aria-labelledby="popular-title"
        className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-14 md:px-8 xl:px-20"
      >
        <div>
          <h2 id="popular-title" className="type-title">
            {t('popularTitle')}
          </h2>
          <p className="type-body-s text-fg-muted">{t('popularSubtitle')}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {popularSearches(hoods).map((link) => (
            <li key={link.id}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-pill border border-line bg-panel px-4 type-body-s text-action hover:border-action"
              >
                {'key' in link.label ? tMenus(link.label.key, link.label.values) : link.label.text}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
