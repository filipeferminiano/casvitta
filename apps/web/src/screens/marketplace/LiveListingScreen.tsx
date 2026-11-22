import { Panel, PhotoPlaceholder, formatBRL } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

import type { LiveListing } from '@/lib/data/live-listing';

import { LiveListingContactForm } from './LiveListingContactForm';

/**
 * A real listing on casvitta.com.br/imovel/… (CRM: every published CRM property). Only facts from
 * the record; missing costs say "Não informado"; the neighborhood, never the exact address.
 */
export async function LiveListingScreen({
  listing: l,
  pageUrl,
}: {
  listing: LiveListing;
  pageUrl: string;
}) {
  const t = await getTranslations('liveListing');
  const tKinds = await getTranslations('crm.properties.kinds');
  const kind = tKinds(l.kind);
  const title = l.title ?? `${kind} · ${l.neighborhood}`;
  const rentRow = l.transaction === 'rent';
  const known = [rentRow ? l.price_cents : 0, l.condo_fee_cents ?? 0, l.iptu_monthly_cents ?? 0];
  const missing = l.condo_fee_cents == null || l.iptu_monthly_cents == null;
  const specs = [
    l.area_m2 != null ? t('area', { n: l.area_m2 }) : null,
    l.bedrooms != null ? t('bedrooms', { n: l.bedrooms }) : null,
    l.suites ? t('suites', { n: l.suites }) : null,
    l.parking != null ? t('parking', { n: l.parking }) : null,
    l.floor != null ? t('floor', { n: l.floor }) : null,
  ].filter((s): s is string => s !== null);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        {l.photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={title}>
            {l.photos.slice(0, 6).map((src, i) => (
              <li key={src} className={i === 0 ? 'col-span-2 row-span-2 sm:col-span-2' : ''}>
                {/* eslint-disable-next-line @next/next/no-img-element -- broker photos from storage */}
                <img
                  src={src}
                  alt={t('photoOf', { n: i + 1, total: l.photos.length })}
                  className="aspect-[4/3] w-full rounded-card object-cover"
                />
              </li>
            ))}
          </ul>
        ) : (
          <PhotoPlaceholder caption={t('noPhotos')} className="h-[280px] w-full rounded-card" />
        )}
        <header className="flex flex-col gap-1">
          <p className="type-eyebrow">
            {l.transaction === 'sale' ? t('sale') : t('rent')} · {l.neighborhood}, {l.city}
          </p>
          <h1 className="type-display-l">{title}</h1>
          <p className="font-mono text-[26px] leading-8 font-semibold tabular">
            {formatBRL(l.price_cents)}
          </p>
          <p className="type-caption">{t('code', { code: l.code })}</p>
        </header>
        {specs.length ? (
          <Panel title={t('specs')}>
            <p className="type-body">{specs.join(' · ')}</p>
            {l.features.length ? (
              <p className="mt-2 type-body-s text-fg-muted">{l.features.join(' · ')}</p>
            ) : null}
          </Panel>
        ) : null}
        <Panel title={t('costs')}>
          <table className="w-full type-body-s">
            <tbody>
              {rentRow ? (
                <tr>
                  <th scope="row" className="py-1 text-left font-normal text-fg-muted">
                    {t('costRent')}
                  </th>
                  <td className="py-1 text-right tabular">{formatBRL(l.price_cents)}</td>
                </tr>
              ) : null}
              <tr>
                <th scope="row" className="py-1 text-left font-normal text-fg-muted">
                  {t('costCondo')}
                </th>
                <td className="py-1 text-right tabular">
                  {l.condo_fee_cents != null ? formatBRL(l.condo_fee_cents) : t('notInformed')}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-left font-normal text-fg-muted">
                  {t('costIptu')}
                </th>
                <td className="py-1 text-right tabular">
                  {l.iptu_monthly_cents != null
                    ? formatBRL(l.iptu_monthly_cents)
                    : t('notInformed')}
                </td>
              </tr>
              {rentRow ? (
                <tr className="border-t border-line font-semibold">
                  <th scope="row" className="py-1 text-left">
                    {missing ? t('totalPartial') : t('costTotal')}
                  </th>
                  <td className="py-1 text-right tabular">
                    {formatBRL(known.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="mt-2 type-caption">{t('costNote')}</p>
        </Panel>
        {l.description ? (
          <Panel title={t('description')}>
            <p className="whitespace-pre-line type-body">{l.description}</p>
          </Panel>
        ) : null}
        <Panel title={t('location')}>
          <p className="type-body">
            {[l.street, l.neighborhood, `${l.city}, ${l.state}`].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 type-caption">{t('locationNote')}</p>
        </Panel>
      </div>
      <aside className="flex flex-col gap-6">
        <Panel title={t('broker')}>
          <p className="type-title">{l.broker.display_name}</p>
          <p className="type-body-s">
            {t('creci', { state: l.broker.creci_state, number: l.broker.creci_number })}
          </p>
          <p className="mt-1 type-caption text-success">{t('creciChecked')}</p>
        </Panel>
        <LiveListingContactForm slug={l.slug} code={l.code} pageUrl={pageUrl} />
      </aside>
    </div>
  );
}
