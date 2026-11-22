'use client';

import { Button, LogoMark, PhotoPlaceholder, SegmentedControl, cn, formatBRL } from '@casvitta/ui';
import { ExternalLink, MessageCircle, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { sendPageEvent, sourceFromSearch, whatsappHref, type PageTheme } from '@/lib/data/page';

import { Finder, OwnerForm } from './PageForms';

export type StorefrontProperty = {
  code: string;
  slug: string;
  kind: string;
  transaction: 'sale' | 'rent';
  title: string | null;
  neighborhood: string;
  city: string;
  price_cents: number;
  area_m2: number | null;
  bedrooms: number | null;
  suites: number | null;
  parking: number | null;
  photos: string[];
};

export type StorefrontData = {
  slug: string;
  theme: PageTheme;
  display_name: string;
  works_as: 'broker' | 'agency';
  agency_name: string | null;
  photo_url: string | null;
  bio: string | null;
  regions: string[];
  whatsapp_e164: string | null;
  creci: string | null;
  creci_verified: boolean;
  branded: boolean;
  /** Finder and owner form (plans with tracked_forms). */
  forms: boolean;
  /** Seleções and "Vi no Instagram" (plans with page_collections; live properties only). */
  collections?: Array<{ title: string; codes: string[] }>;
  instagram?: Array<{ url: string; label: string; code: string }>;
  properties: StorefrontProperty[];
};

type Tab = 'sale' | 'rent' | 'owner';
type Mode = 'page' | 'finder' | 'owner';

const currentSource = () => sourceFromSearch(new URLSearchParams(window.location.search));

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/**
 * Casvitta Social storefront (docs/mockups/social/01): identity, CRECI, one WhatsApp action,
 * Comprar/Alugar/Anunciar and the published properties. `preview` renders it inside the app
 * (onboarding step 6) without links or counters.
 */
export function Storefront({ page, preview = false }: { page: StorefrontData; preview?: boolean }) {
  const t = useTranslations('social.storefront');
  const firstName = page.display_name.split(' ')[0] ?? page.display_name;
  const [tab, setTab] = useState<Tab>(
    page.properties.some((p) => p.transaction === 'sale') ||
      !page.properties.some((p) => p.transaction === 'rent')
      ? 'sale'
      : 'rent',
  );

  useEffect(() => {
    if (preview) return;
    sendPageEvent(page.slug, 'page_view', currentSource());
  }, [page.slug, preview]);

  const whatsapp = (text: string) =>
    page.whatsapp_e164 && !preview ? whatsappHref(page.whatsapp_e164, text) : undefined;
  const onWhatsapp = () => {
    if (!preview) sendPageEvent(page.slug, 'whatsapp_click', currentSource());
  };
  const [mode, setMode] = useState<Mode>('page');
  const open = (next: Mode) => {
    setMode(next);
    window.scrollTo({ top: 0 });
  };
  const ownerAction =
    page.forms && !preview
      ? { onClick: () => open('owner') }
      : { href: whatsapp(t('ownerGreeting', { name: firstName })), onClick: onWhatsapp };
  const role = page.works_as === 'agency' ? t('roleAgency') : t('roleBroker');
  const shown = page.properties.filter((p) => p.transaction === tab);

  return (
    <div data-page-theme={page.theme} className={cn('bg-canvas text-fg', !preview && 'min-h-dvh')}>
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col items-center gap-2 text-center">
          {page.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- broker photo from storage
            <img
              src={page.photo_url}
              alt=""
              className="size-24 rounded-pill border-4 border-panel object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-24 items-center justify-center rounded-pill border-4 border-panel bg-accent-subtle font-display text-[32px] font-semibold text-accent"
            >
              {initials(page.display_name)}
            </span>
          )}
          <h1 className="type-display-l">{page.display_name}</h1>
          <p className="type-body-s text-fg-strong">
            {[role, page.agency_name].filter(Boolean).join(' · ')}
          </p>
          {page.creci ? (
            <p className="flex flex-wrap items-center justify-center gap-2 type-caption">
              <span className="rounded-chip border border-fg px-2 py-0.5 font-mono text-fg">
                {page.creci}
              </span>
              {page.creci_verified ? (
                <span className="text-action">{t('creciChecked')}</span>
              ) : null}
            </p>
          ) : null}
          {page.regions.length ? (
            <p className="type-body-s text-fg-muted">{page.regions.join(' · ')}</p>
          ) : null}
          {page.bio ? <p className="max-w-md type-body text-fg-strong">{page.bio}</p> : null}
        </header>

        {mode === 'finder' ? (
          <Finder
            page={page}
            onClose={() => setMode('page')}
            renderProperty={(p) => <PropertyCard property={p} preview={false} />}
          />
        ) : mode === 'owner' ? (
          <OwnerForm page={page} onClose={() => setMode('page')} />
        ) : null}

        {mode !== 'page' ? null : page.whatsapp_e164 ? (
          preview ? (
            <span className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-action px-5 type-body-s font-semibold text-fg-on-action">
              <MessageCircle aria-hidden="true" className="size-5" />
              {t('whatsapp', { name: firstName })}
            </span>
          ) : (
            <Button asChild className="h-14 w-full rounded-pill">
              <a
                href={whatsapp(t('whatsappGreeting', { name: firstName }))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onWhatsapp}
              >
                <MessageCircle aria-hidden="true" />
                {t('whatsapp', { name: firstName })}
              </a>
            </Button>
          )
        ) : null}

        {mode !== 'page' ? null : (
          <>
            <SegmentedControl
              label={t('tabsLabel')}
              value={tab}
              onValueChange={(v) => setTab(v as Tab)}
              options={[
                { value: 'sale', label: t('tabs.sale') },
                { value: 'rent', label: t('tabs.rent') },
                { value: 'owner', label: t('tabs.owner') },
              ]}
              className="w-full"
            />

            {tab !== 'owner' && page.instagram?.length ? (
              <InstagramRow page={page} preview={preview} />
            ) : null}

            {tab === 'owner' ? (
              <OwnerCta {...ownerAction} />
            ) : (
              <section aria-labelledby="page-properties" className="flex flex-col gap-4">
                <h2 id="page-properties" className="type-title">
                  {tab === 'sale' ? t('forSale') : t('forRent')}
                </h2>
                {shown.length === 0 ? (
                  <p className="rounded-card border border-line bg-panel p-4 type-body-s text-fg-strong">
                    {preview && !page.creci_verified
                      ? t('previewWaitingCreci')
                      : t(tab === 'sale' ? 'emptySale' : 'emptyRent', { name: firstName })}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-5">
                    {shown.map((p) => (
                      <li key={p.code}>
                        <PropertyCard property={p} preview={preview} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {tab !== 'owner' && page.collections?.length ? (
              <Selections page={page} preview={preview} />
            ) : null}

            {tab !== 'owner' && page.forms ? (
              <section className="flex flex-col gap-3 rounded-card border border-line bg-panel p-5">
                <p className="type-body text-fg-strong">{t('finderText')}</p>
                <Button
                  variant="secondary"
                  className="h-12 rounded-pill"
                  onClick={preview ? undefined : () => open('finder')}
                >
                  {t('finderAction')}
                </Button>
              </section>
            ) : null}

            {tab !== 'owner' ? <OwnerCta {...ownerAction} /> : null}
          </>
        )}

        <footer className="flex flex-col items-center gap-3 border-t border-line pt-5 text-center type-caption">
          <p>{[page.display_name, page.creci].filter(Boolean).join(' · ')}</p>
          {page.branded ? (
            <a
              href={preview ? undefined : 'https://casvitta.com.br/para-corretores'}
              className="inline-flex items-center gap-2 text-fg-muted underline-offset-4 hover:underline"
            >
              <LogoMark size={14} title={null} />
              {t('createYours')}
            </a>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

const ownerButtonClass =
  'flex h-12 items-center justify-center rounded-pill bg-accent px-5 type-body-s font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** "Quero vender ou alugar meu imóvel": the owner form (plans with forms) or WhatsApp. */
function OwnerCta({ href, onClick }: { href?: string | undefined; onClick: () => void }) {
  const t = useTranslations('social.storefront');
  return (
    <section className="flex flex-col gap-3 rounded-card bg-accent-subtle p-5">
      <h2 className="type-title text-accent">{t('ownerTitle')}</h2>
      <p className="type-body-s text-fg-strong">{t('ownerText')}</p>
      {href === undefined && onClick ? (
        <button type="button" onClick={onClick} className={ownerButtonClass}>
          {t('ownerAction')}
        </button>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className={ownerButtonClass}
        >
          {t('ownerAction')}
        </a>
      )}
    </section>
  );
}

export function PropertyCard({
  property: p,
  preview,
}: {
  property: StorefrontProperty;
  preview: boolean;
}) {
  const t = useTranslations('social.storefront');
  const tKinds = useTranslations('crm.properties.kinds');
  const title = p.title ?? t('defaultTitle', { kind: tKinds(p.kind), place: p.neighborhood });
  const specs = [
    p.bedrooms != null ? t('bedrooms', { n: p.bedrooms }) : null,
    p.suites ? t('suites', { n: p.suites }) : null,
    p.parking != null ? t('parking', { n: p.parking }) : null,
    p.area_m2 != null ? t('area', { n: p.area_m2 }) : null,
  ].filter(Boolean);
  const body = (
    <>
      <div className="relative">
        {p.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- property photo from storage
          <img
            src={p.photos[0]}
            alt=""
            className="aspect-[16/10] w-full rounded-card object-cover"
          />
        ) : (
          <PhotoPlaceholder
            caption={t('photoSoon')}
            className="aspect-[16/10] w-full rounded-card"
          />
        )}
        <span className="absolute top-3 left-3 rounded-pill bg-panel px-3 py-1 type-caption font-semibold text-fg">
          {p.transaction === 'sale' ? t('badge.sale') : t('badge.rent')}
        </span>
      </div>
      <p className="mt-3 font-mono text-[20px] leading-7 font-semibold tabular">
        {formatBRL(p.price_cents)}
        {p.transaction === 'rent' ? t('perMonth') : ''}
      </p>
      <p className="type-body font-semibold">{title}</p>
      {specs.length ? <p className="type-body-s text-fg-muted">{specs.join(' · ')}</p> : null}
      <p className="type-caption font-mono">{p.code}</p>
    </>
  );
  return preview ? (
    <div>{body}</div>
  ) : (
    <a
      href={`/${p.slug}`}
      className="block rounded-card focus-visible:outline-2 focus-visible:outline-focus"
    >
      {body}
    </a>
  );
}

/** "Vi no Instagram": posts the broker mapped by hand to a property (nothing read from Instagram). */
function InstagramRow({ page, preview }: { page: StorefrontData; preview: boolean }) {
  const t = useTranslations('social.storefront');
  const byCode = new Map(page.properties.map((p) => [p.code, p]));
  return (
    <section aria-labelledby="page-instagram" className="flex flex-col gap-3">
      <h2 id="page-instagram" className="type-title">
        {t('instagramTitle')}
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {(page.instagram ?? []).map((post) => {
          const property = byCode.get(post.code);
          return (
            <li key={post.url} className="flex w-36 shrink-0 snap-start flex-col gap-1.5">
              <a
                href={preview || !property ? undefined : `/${property.slug}`}
                className="flex flex-col gap-1.5 rounded-card focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span className="relative flex aspect-[4/5] items-end overflow-hidden rounded-card bg-accent-subtle p-2">
                  {property?.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- property photo from storage
                    <img
                      src={property.photos[0]}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : null}
                  <Play
                    aria-hidden="true"
                    className="absolute top-2 left-2 size-6 rounded-pill bg-panel p-1 text-accent"
                  />
                  <span className="relative rounded-pill bg-panel px-2 py-0.5 font-mono type-caption text-fg">
                    {post.code}
                  </span>
                </span>
                <span className="type-body-s font-semibold">{post.label}</span>
              </a>
              <a
                href={preview ? undefined : post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hit-area-44 inline-flex items-center gap-1 type-caption text-fg-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
              >
                {t('openPost')}
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Seleções: chips; the chosen one lists its properties right below. */
function Selections({ page, preview }: { page: StorefrontData; preview: boolean }) {
  const t = useTranslations('social.storefront');
  const [open, setOpen] = useState<number | null>(null);
  const byCode = new Map(page.properties.map((p) => [p.code, p]));
  const chosen = open == null ? null : (page.collections ?? [])[open];
  return (
    <section aria-labelledby="page-selections" className="flex flex-col gap-3">
      <h2 id="page-selections" className="type-title">
        {t('selectionsTitle')}
      </h2>
      <div className="flex flex-wrap gap-2">
        {(page.collections ?? []).map((c, i) => (
          <button
            key={c.title}
            type="button"
            aria-pressed={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            className={cn(
              'hit-area-44 inline-flex min-h-10 items-center rounded-pill border px-4 type-body-s font-medium',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              open === i
                ? 'border-accent bg-accent-subtle text-fg'
                : 'border-line bg-panel text-fg',
            )}
          >
            {c.title}
          </button>
        ))}
      </div>
      {chosen ? (
        <ul aria-label={chosen.title} className="flex flex-col gap-5">
          {chosen.codes.map((code) => {
            const p = byCode.get(code);
            return p ? (
              <li key={code}>
                <PropertyCard property={p} preview={preview} />
              </li>
            ) : null;
          })}
        </ul>
      ) : null}
    </section>
  );
}
