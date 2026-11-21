import { AudienceCard, NumberedSteps } from '@casvitta/ui';
import { ChevronRight, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SoonBadge } from '@/components/badges';
import { listPublicListings } from '@/lib/data/marketplace';

import { HomeSearch } from './HomeSearch';
import { ListingGrid } from './ListingGrid';
import { FinancingSimulator } from './ListingIslands';
import { TOOL_LINKS } from './tool-links';

const AUDIENCES = [
  { key: 'owner', href: '/anunciar-imovel', soon: false },
  { key: 'broker', href: '/para-corretores', soon: false },
  { key: 'agency', href: '/para-imobiliarias', soon: false },
  { key: 'developer', href: '/incorporadoras', soon: true },
] as const;

const TRUST = [
  { key: 'creci', icon: FileText },
  { key: 'ai', icon: Sparkles },
  { key: 'data', icon: ShieldCheck },
] as const;

/** casvitta.com.br home (mockups 51 desktop, 52 mobile). */
export async function HomeScreen() {
  const t = await getTranslations('home');
  const tTools = await getTranslations('marketplace.tools');
  // Featured: published listings only (rule 2). Not a search, so no sponsored slots here:
  // "Patrocinado" only appears in searches the property matches (Destaques §4).
  const featured = listPublicListings().slice(0, 4);
  const sample = featured[0]?.property.priceCents ?? 69_000_000;

  return (
    <>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-8 pb-10 md:px-8 md:pt-14 xl:px-20">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        <h1 className="max-w-[20ch] type-display-l md:text-[56px] md:leading-[60px]">
          {t('title')}
        </h1>
        <p className="max-w-[60ch] type-body text-fg-strong">{t('subtitle')}</p>
        <div className="max-w-4xl">
          <HomeSearch />
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-12 md:px-8 xl:px-20">
        <div className="flex items-baseline justify-between">
          <h2 className="type-title">{t('featured')}</h2>
          <Link
            href="/comprar"
            className="type-body-s font-semibold text-action underline underline-offset-2"
          >
            {t('seeAll')}
          </Link>
        </div>
        {/* Phones show two featured listings (mockup 52). */}
        <div className="max-md:[&_li:nth-child(n+3)]:hidden">
          <ListingGrid
            listings={featured}
            columns={4}
            emptyTitle={t('emptyTitle')}
            emptyDescription={t('emptyDescription')}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 md:px-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:px-20">
        <div className="hidden flex-col gap-4 md:flex">
          <h2 className="type-title">{t('how.title')}</h2>
          <NumberedSteps
            steps={(['search', 'questions', 'visit'] as const).map((key) => ({
              key,
              title: t(`how.${key}.title`),
              description: t(`how.${key}.description`),
            }))}
          />
        </div>
        <div id="simulador" className="scroll-mt-20">
          <FinancingSimulator priceCents={sample} editablePrice title={t('simulatorTitle')} />
        </div>
      </section>

      {/* Entry into the market-data pages (site link structure: home → tools → bairro). */}
      <nav
        aria-labelledby="tools-title"
        className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-14 md:px-8 xl:px-20"
      >
        <div>
          <h2 id="tools-title" className="type-title">
            {tTools('title')}
          </h2>
          <p className="type-body-s text-fg-muted">{tTools('subtitle')}</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOL_LINKS.map((link) => (
            <li key={link.key}>
              <Link
                href={link.href}
                className="flex h-full min-h-11 items-start justify-between gap-3 rounded-card border border-line bg-panel p-4 hover:border-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex flex-col gap-1">
                  <span className="type-body-s font-semibold text-action">{tTools(link.key)}</span>
                  <span className="type-caption">{tTools(`${link.key}Description`)}</span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  strokeWidth={1.6}
                  className="mt-0.5 size-4 shrink-0 text-action"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mx-4 mb-10 rounded-card border border-line bg-panel md:hidden">
        <h2 className="px-4 pt-4 pb-2 type-title text-[20px]">{t('audiences.mobileTitle')}</h2>
        <ul>
          {AUDIENCES.map((a) => (
            <li key={a.key} className="border-t border-line">
              <Link href={a.href} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="flex-1">
                  <span className="block type-body-s font-semibold">
                    {t(`audiences.${a.key}.mobileTitle`)}
                  </span>
                  <span className="block type-caption">
                    {t(`audiences.${a.key}.mobileDescription`)}
                  </span>
                </span>
                <span aria-hidden="true" className="text-fg-muted">
                  {'›'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="hidden bg-fg text-white md:block">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 md:px-8 xl:px-20">
          <p className="font-mono text-[12px] tracking-[0.08em] text-ink-300 uppercase">
            {t('audiences.eyebrow')}
          </p>
          <h2 className="type-display-l text-white">{t('audiences.title')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((a) => (
              <AudienceCard
                key={a.key}
                title={t(`audiences.${a.key}.title`)}
                description={t(`audiences.${a.key}.description`)}
                soon={a.soon ? <SoonBadge /> : undefined}
                action={
                  <Link href={a.href} className="underline underline-offset-2">
                    {t(`audiences.${a.key}.cta`)}
                    <span aria-hidden="true">{' ›'}</span>
                  </Link>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto hidden max-w-7xl gap-6 px-4 py-10 md:grid md:grid-cols-3 md:px-8 xl:px-20">
        {TRUST.map(({ key, icon: Icon }) => (
          <div key={key} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-control bg-action-subtle text-action"
            >
              <Icon strokeWidth={1.6} className="size-5" />
            </span>
            <div>
              <p className="type-body-s font-semibold">{t(`trust.${key}.title`)}</p>
              <p className="type-body-s text-fg-strong">{t(`trust.${key}.description`)}</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
