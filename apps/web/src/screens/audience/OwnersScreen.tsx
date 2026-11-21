import {
  AudienceTag,
  CheckList,
  FeatureCard,
  NumberedSteps,
  OfferCard,
  PhotoPlaceholder,
  type FaqItem,
} from '@casvitta/ui';
import { CalendarClock, LayoutList, MessageCircle, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { OFFERS } from '@/config/site';
import { formatBRL, formatDate } from '@/lib/format';

import { startAnchor } from './anchors';
import { OwnerStartForm } from './OwnerStartForm';
import { BROKER_LISTING_NEARBY, DEMO_BROKER, OWNER_LISTING } from './preview-data';
import { CreciFooter, ListingMini, OwnerBadge, PreviewFigure } from './previews';
import {
  AudienceJsonLd,
  CONTAINER,
  FaqSection,
  FinalCta,
  PreviewNote,
  Section,
  SectionHeading,
  linkButtonClass,
} from './shared';

const FAQ_KEYS = ['software', 'transaction', 'ends', 'guarantee', 'highlight'] as const;
const BENEFITS = [
  { key: 'simple', icon: Package },
  { key: 'organized', icon: LayoutList },
  { key: 'direct', icon: MessageCircle },
  { key: 'deadline', icon: CalendarClock },
] as const;

export function useOwnersFaq(): FaqItem[] {
  const t = useTranslations('audience.owners.faq');
  return FAQ_KEYS.map((key) => ({ key, question: t(`${key}.q`), answer: t(`${key}.a`) }));
}

/** Landing page for owners (mockup landing-pages/01): one-off listing, no software. */
export function OwnersScreen() {
  const t = useTranslations('audience.owners');
  const tTags = useTranslations('audience.tags');
  const tCommon = useTranslations('audience.common');
  const faq = useOwnersFaq();
  const packs = OFFERS.ownerPacks;
  const [short, long] = [packs[0]!, packs[packs.length - 1]!];

  return (
    <>
      <AudienceJsonLd
        path="/anunciar-imovel"
        homeLabel={tCommon('home')}
        pageLabel={t('meta.breadcrumb')}
        faq={faq}
        offers={packs.map((p) => ({
          name: t('offerName', { days: p.days }),
          priceCents: p.priceCents,
        }))}
      />

      <div
        className={`${CONTAINER} grid grid-cols-1 gap-10 py-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start`}
      >
        <div className="flex flex-col gap-5">
          <span className="inline-flex self-start rounded-pill bg-fg px-2.5 py-1 type-caption font-semibold text-white">
            {t('tag')}
          </span>
          <h1 className="max-w-[16ch] type-display-xl text-balance">{t('title')}</h1>
          <p className="max-w-[60ch] type-body text-fg-strong">{t('subtitle')}</p>
          <div id={startAnchor()} className="relative scroll-mt-24">
            {/* Targets of the pack buttons: the form reads the period from the hash. */}
            {packs.map((p) => (
              <span key={p.key} id={startAnchor(p.days)} className="absolute -top-24" />
            ))}
            <OwnerStartForm packs={packs} />
          </div>
        </div>

        <PreviewFigure label={t('heroCard.label')} note={<PreviewNote />} className="lg:pt-2">
          <div className="relative pb-16">
            <PhotoPlaceholder
              caption={t('heroCard.photo')}
              className="aspect-[4/3] rounded-card border border-line"
            />
            <div className="absolute bottom-0 left-4 w-[min(300px,85%)] rounded-card border border-line bg-panel p-3 shadow-menu">
              <p className="type-caption">{OWNER_LISTING.kicker}</p>
              <p className="font-mono text-[18px] leading-6 font-semibold tabular">
                {formatBRL(OWNER_LISTING.priceCents)}
              </p>
              <p className="type-caption text-fg-strong">{OWNER_LISTING.specs}</p>
              <p className="type-caption">{t('heroCard.published')}</p>
              <div className="mt-1">
                <OwnerBadge />
              </div>
            </div>
          </div>
        </PreviewFigure>
      </div>

      <Section tone="panel" labelledBy="preview-title" className="flex flex-col gap-8">
        <SectionHeading
          id="preview-title"
          eyebrow={t('preview.eyebrow')}
          title={t('preview.title')}
          subtitle={t('preview.subtitle')}
        />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <PreviewFigure label={t('preview.label')}>
            <div className="overflow-hidden rounded-card border border-line bg-panel">
              <div className="grid grid-cols-3 grid-rows-2 gap-0.5 bg-line">
                <PhotoPlaceholder
                  caption={t('preview.mainPhoto')}
                  className="col-span-2 row-span-2 aspect-[4/3]"
                />
                <PhotoPlaceholder caption={t('preview.photo2')} />
                <PhotoPlaceholder caption={t('preview.photo3')} />
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <OwnerBadge />
                    <AudienceTag kind="portal">{tTags('portal')}</AudienceTag>
                  </div>
                  <p className="type-title">{OWNER_LISTING.title}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {OWNER_LISTING.chips.map((chip) => (
                      <li
                        key={chip}
                        className="rounded-chip border border-line px-1.5 py-0.5 font-mono text-[12px] tabular"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                  <p className="type-body-s text-fg-strong">{OWNER_LISTING.description}</p>
                </div>
                <div className="flex flex-col gap-2 self-start rounded-card border border-line p-4">
                  <p className="type-caption">{t('preview.sale')}</p>
                  <p className="font-mono text-[24px] leading-7 font-semibold tabular">
                    {formatBRL(OWNER_LISTING.priceCents)}
                  </p>
                  <p className="type-caption">
                    {t('preview.condo', { amount: formatBRL(OWNER_LISTING.condoCents) })} ·{' '}
                    {t('preview.iptu', { amount: formatBRL(OWNER_LISTING.iptuCents) })}
                  </p>
                  <span className="mt-1 flex min-h-11 items-center justify-center rounded-control bg-action px-4 type-body-s font-semibold text-white">
                    {t('preview.contact')}
                  </span>
                  <p className="type-caption">
                    {t('preview.until', {
                      date: formatDate(new Date(`${OWNER_LISTING.until}T12:00:00-03:00`)),
                    })}
                  </p>
                </div>
              </div>
            </div>
          </PreviewFigure>
          <div className="flex flex-col gap-4">
            <CheckList items={[0, 1, 2].map((i) => t(`preview.points.${i}`))} />
            <p className="flex flex-wrap items-center gap-2 type-caption">
              <PreviewNote>{t('preview.note')}</PreviewNote>
            </p>
          </div>
        </div>
      </Section>

      <Section labelledBy="how-title" className="flex flex-col gap-8">
        <SectionHeading id="how-title" eyebrow={t('how.eyebrow')} title={t('how.title')} />
        <NumberedSteps
          steps={[
            {
              key: 'register',
              title: t('how.register.title'),
              description: t('how.register.description'),
            },
            {
              key: 'period',
              title: t('how.period.title'),
              description: t('how.period.description', {
                shortDays: short.days,
                shortPrice: formatBRL(short.priceCents),
                longDays: long.days,
                longPrice: formatBRL(long.priceCents),
              }),
            },
            {
              key: 'publish',
              title: t('how.publish.title'),
              description: t('how.publish.description'),
            },
          ]}
        />
      </Section>

      <Section labelledBy="benefits-title" className="flex flex-col gap-8">
        <SectionHeading
          id="benefits-title"
          eyebrow={t('benefits.eyebrow')}
          title={t('benefits.title')}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ key, icon: Icon }) => (
            <FeatureCard
              key={key}
              icon={<Icon strokeWidth={1.6} />}
              title={t(`benefits.${key}.title`)}
              description={t(`benefits.${key}.description`)}
            />
          ))}
        </div>
      </Section>

      <Section id="pacotes" labelledBy="packs-title" className="flex flex-col gap-8">
        <SectionHeading
          id="packs-title"
          eyebrow={t('packs.eyebrow')}
          title={t('packs.title')}
          subtitle={t('packs.subtitle')}
        />
        <div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          {packs.map((pack, i) => {
            const featured = i === packs.length - 1;
            return (
              <OfferCard
                key={pack.key}
                highlighted={featured}
                name={t('packs.name', { days: pack.days })}
                tags={<AudienceTag kind="portal">{tTags('portal')}</AudienceTag>}
                price={formatBRL(pack.priceCents)}
                period={tCommon('oneOff')}
                included={{
                  items: [
                    t('packs.items.publication'),
                    t('packs.items.transaction'),
                    t('packs.items.contacts'),
                    t('packs.items.noSoftware'),
                    t('packs.items.ends', { days: pack.days }),
                  ],
                }}
                action={
                  <a
                    href={`#${startAnchor(pack.days)}`}
                    data-track="select_plan"
                    data-track-plan={`owner_${pack.key}`}
                    className={linkButtonClass(featured ? 'primary' : 'secondary')}
                  >
                    {t('packs.cta', { days: pack.days })}
                  </a>
                }
              />
            );
          })}
        </div>
        <p className="max-w-[70ch] type-body-s text-fg-strong">{t('packs.note')}</p>
      </Section>

      <Section
        tone="attention"
        labelledBy="highlight-title"
        className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center"
      >
        <div className="flex flex-col gap-4">
          <AudienceTag kind="highlight" className="self-start">
            {tTags('highlight')}
          </AudienceTag>
          <h2 id="highlight-title" className="type-display-l text-balance">
            {t('highlight.title')}
          </h2>
          <p className="max-w-[60ch] type-body text-fg-strong">{t('highlight.body')}</p>
          <p className="max-w-[60ch] rounded-control border border-line bg-panel px-4 py-3 type-body-s text-fg-strong">
            {t('highlight.callout')}
          </p>
        </div>
        <PreviewFigure label={t('highlight.label')} note={<PreviewNote />}>
          <div className="grid grid-cols-2 gap-3">
            <ListingMini
              highlight
              kicker={OWNER_LISTING.shortKicker}
              price={formatBRL(OWNER_LISTING.priceCents)}
              specs={OWNER_LISTING.shortSpecs}
              footer={<OwnerBadge />}
            />
            <ListingMini
              kicker={BROKER_LISTING_NEARBY.kicker}
              price={formatBRL(BROKER_LISTING_NEARBY.priceCents)}
              specs={BROKER_LISTING_NEARBY.specs}
              footer={<CreciFooter {...DEMO_BROKER} />}
            />
          </div>
        </PreviewFigure>
      </Section>

      <FaqSection items={faq} />

      <FinalCta
        title={t('final.title')}
        subtitle={t('final.subtitle', { shortDays: short.days, longDays: long.days })}
        action={
          <a href={`#${startAnchor()}`} className={linkButtonClass('attention')}>
            {t('final.cta')}
          </a>
        }
      />
    </>
  );
}
