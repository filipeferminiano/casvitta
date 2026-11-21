import { Breadcrumbs } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { whatsappLink } from '@/config/site';
import {
  cityListingsPath,
  incomePath,
  priceM2Path,
  search,
  TOOL_PATHS,
  valuationPath,
  type NavHood,
} from '@/lib/site-nav';

type Item = { id: string; href: string; label: string; soon?: boolean };
type Column = { key: string; id?: string; items: Item[] };

/** /mapa-do-site (docs/mockups/navigation/site-map): every public page, by topic, from the data. */
export async function SiteMapScreen({ hoods }: { hoods: NavHood[] }) {
  const t = await getTranslations('siteMap');
  const tl = await getTranslations('marketplace.menus.links');
  const tSoon = await getTranslations('marketplace.menus');

  const hoodItems = (href: (h: NavHood) => string, label: (h: NavHood) => string = (h) => h.name) =>
    hoods.map((h) => ({ id: h.slug, href: href(h), label: label(h) }));
  const byType = (tx: 'sale' | 'rent'): Column => ({
    key: 'byType',
    items: [
      { id: 'apartments', href: search(tx, { kind: 'apartment' }), label: tl(`${tx}.apartments`) },
      { id: 'houses', href: search(tx, { kind: 'house' }), label: tl(`${tx}.houses`) },
      { id: 'all', href: cityListingsPath(tx), label: tl(`${tx}.all`) },
    ],
  });

  const groups: { key: string; id: string; columns: Column[] }[] = [
    {
      key: 'buy',
      id: 'comprar',
      columns: [
        byType('sale'),
        { key: 'byHood', items: hoodItems((h) => search('sale', { where: h.name })) },
        {
          key: 'beforeBuying',
          items: [
            { id: 'simulate', href: TOOL_PATHS.simulate, label: tl('simulate') },
            { id: 'itbi', href: TOOL_PATHS.itbi, label: tl('itbi') },
            { id: 'priceM2', href: TOOL_PATHS.priceM2, label: tl('cityPriceM2') },
          ],
        },
      ],
    },
    {
      key: 'rent',
      id: 'alugar',
      columns: [
        byType('rent'),
        { key: 'byHood', items: hoodItems((h) => search('rent', { where: h.name })) },
      ],
    },
    {
      key: 'sell',
      id: 'vender',
      columns: [
        {
          key: 'yourProperty',
          items: [
            { id: 'list', href: '/anunciar-imovel', label: tl('listMine') },
            { id: 'valuation', href: TOOL_PATHS.valuation, label: tl('valuation') },
          ],
        },
        { key: 'valuationByHood', items: hoodItems((h) => valuationPath(h.slug)) },
      ],
    },
    {
      key: 'tools',
      id: 'ferramentas',
      columns: [
        {
          key: 'calculators',
          items: [
            { id: 'valuation', href: TOOL_PATHS.valuation, label: tl('valuation') },
            { id: 'itbi', href: TOOL_PATHS.itbi, label: tl('itbi') },
            { id: 'simulate', href: TOOL_PATHS.simulate, label: tl('simulate') },
          ],
        },
        {
          key: 'priceM2',
          items: [
            { id: 'city', href: TOOL_PATHS.priceM2, label: t('links.cityPriceM2') },
            ...hoodItems((h) => priceM2Path(h.slug)),
          ],
        },
        { key: 'income', id: 'quanto-preciso-ganhar', items: hoodItems((h) => incomePath(h.slug)) },
        {
          key: 'byAddress',
          id: 'por-endereco',
          // Each neighborhood page lists its streets and buildings that pass the threshold.
          items: hoodItems(
            (h) => priceM2Path(h.slug),
            (h) => t('links.streetsAndBuildings', { where: h.inName }),
          ),
        },
      ],
    },
    {
      key: 'pros',
      id: 'profissionais',
      columns: [
        {
          key: 'brokers',
          items: [{ id: 'brokers', href: '/para-corretores', label: tl('brokerPlans') }],
        },
        {
          key: 'companies',
          items: [
            { id: 'agencies', href: '/para-imobiliarias', label: tl('agencies') },
            { id: 'developers', href: '/incorporadoras', label: tl('developers'), soon: true },
            { id: 'investors', href: '/investidores', label: tl('investors') },
            { id: 'auction', href: '/leilao', label: t('links.auction') },
          ],
        },
        {
          key: 'casvitta',
          items: [
            { id: 'about', href: '/sobre', label: t('links.about') },
            { id: 'contact', href: whatsappLink(), label: t('links.contact') },
          ],
        },
        {
          key: 'legal',
          items: [
            { id: 'privacy', href: '/privacidade', label: t('links.privacy') },
            { id: 'terms', href: '/termos', label: t('links.terms') },
          ],
        },
      ],
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 pt-6 pb-16 md:px-8 xl:px-20">
      <Breadcrumbs
        label={t('breadcrumbLabel')}
        items={[{ label: t('home'), href: '/' }, { label: t('breadcrumb') }]}
        renderLink={(href, children) => <Link href={href}>{children}</Link>}
      />
      <div>
        <h1 className="type-display-l">{t('title')}</h1>
        <p className="mt-2 max-w-[65ch] type-body text-fg-strong">{t('intro')}</p>
        {hoods.length ? null : <p className="mt-2 type-body-s text-fg-muted">{t('noData')}</p>}
      </div>
      {groups.map((group) => (
        <section
          key={group.key}
          id={group.id}
          aria-labelledby={`${group.id}-title`}
          className="flex scroll-mt-20 flex-col gap-3 border-t border-line pt-6"
        >
          <h2 id={`${group.id}-title`} className="type-title">
            {t(`groups.${group.key}`)}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {group.columns
              .filter((c) => c.items.length)
              .map((column) => (
                <div key={column.key} id={column.id} className="flex scroll-mt-20 flex-col gap-1">
                  <h3 className="type-eyebrow">{t(`cols.${column.key}`)}</h3>
                  <ul>
                    {column.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="inline-flex min-h-8 items-center type-body-s text-action hover:underline"
                        >
                          {item.label}
                          {item.soon ? (
                            <span className="ml-1.5 rounded-pill bg-subtle px-2 type-caption text-fg-muted">
                              {tSoon('soon')}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
