import {
  AppPreviewFrame,
  AudienceTag,
  CheckList,
  FeatureCard,
  OfferCard,
  UsageMeter,
  type AppPreviewNavItem,
  type FaqItem,
} from '@casvitta/ui';
import { BellOff, Contact, FolderSearch, House, Megaphone, Repeat, Target } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { OFFERS } from '@/config/site';
import { formatBRL } from '@/lib/format';

import {
  BROKER_HISTORY,
  BROKER_NEXT_STEPS,
  BROKER_PORTAL_LISTINGS,
  BROKER_PROPERTIES,
  BROKER_RECORD,
  BROKER_STAGES,
  BROKER_TODAY,
  BROKER_USAGE,
  DEMO_BROKER,
  HOW_CONTACTS,
  HOW_STAGES,
} from './preview-data';
import {
  CreciFooter,
  ListingMini,
  PreviewFigure,
  PreviewStatusPill,
  formatPreviewPrice,
} from './previews';
import {
  AudienceBreadcrumb,
  AudienceJsonLd,
  CONTAINER,
  FaqSection,
  FinalCta,
  PreviewNote,
  Section,
  SectionHeading,
  TagLegend,
  linkButtonClass,
} from './shared';

const FAQ_KEYS = ['cost', 'limit', 'highlight', 'sources', 'cancel'] as const;
export const BROKER_SIGNUP_HREF = `/cadastro/conta?plano=${OFFERS.brokerPlan.key}`;

export function useBrokersFaq(): FaqItem[] {
  const t = useTranslations('audience.brokers.faq');
  const max = OFFERS.brokerPlan.maxActiveProperties;
  return FAQ_KEYS.map((key) => ({
    key,
    question: t(`${key}.q`),
    answer: t(`${key}.a`, { max }),
  }));
}

type NavKey = 'properties' | 'contacts' | 'opportunities';

/** Side nav of the product pictures; returns a builder so the active item varies per picture. */
function useBrokerNav(): (active: NavKey) => AppPreviewNavItem[] {
  const t = useTranslations('audience.preview.nav');
  const items = [
    { key: 'properties', label: t('properties'), icon: <House strokeWidth={1.6} /> },
    { key: 'contacts', label: t('contacts'), icon: <Contact strokeWidth={1.6} /> },
    { key: 'opportunities', label: t('opportunities'), icon: <Target strokeWidth={1.6} /> },
    { key: 'portal', label: t('portal'), icon: <Megaphone strokeWidth={1.6} /> },
  ];
  return (active) => items.map((item) => ({ ...item, active: item.key === active }));
}

/** One "O software" row: text on one side, a product picture on the other. */
function SoftwareRow({
  title,
  description,
  example,
  picture,
  reverse,
}: {
  title: string;
  description: string;
  example: string;
  picture: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center lg:gap-12">
      <div className={reverse ? 'lg:order-2' : undefined}>
        <h3 className="type-title">{title}</h3>
        <p className="mt-2 type-body text-fg-strong">{description}</p>
        <p className="mt-3 border-l-2 border-line pl-3 type-body-s text-fg-muted">{example}</p>
      </div>
      {picture}
    </div>
  );
}

/** Landing page for independent brokers (mockup landing-pages/02): software + portal included. */
export function BrokersScreen() {
  const t = useTranslations('audience.brokers');
  const tTags = useTranslations('audience.tags');
  const tCommon = useTranslations('audience.common');
  const tPreview = useTranslations('audience.preview');
  const plan = OFFERS.brokerPlan;
  const packs = OFFERS.ownerPacks;
  const faq = useBrokersFaq();
  const nav = useBrokerNav();
  const price = formatBRL(plan.priceCents);
  const summary = { price, users: plan.maxUsers, max: plan.maxActiveProperties };
  const usage = (
    <UsageMeter
      label={tPreview('usage')}
      value={BROKER_USAGE.value}
      max={plan.maxActiveProperties}
      valueLabel={tPreview('usageValue', {
        value: BROKER_USAGE.value,
        max: plan.maxActiveProperties,
      })}
    />
  );
  const appFrame = (props: {
    label: string;
    title: ReactNode;
    active: NavKey;
    children: ReactNode;
  }) => (
    <AppPreviewFrame
      label={props.label}
      url={tPreview('url')}
      title={props.title}
      userName={DEMO_BROKER.name}
      nav={nav(props.active)}
      note={<PreviewNote />}
    >
      {props.children}
    </AppPreviewFrame>
  );
  const signupLink = (location: string, variant: 'primary' | 'attention' = 'primary') => (
    <Link
      href={BROKER_SIGNUP_HREF}
      data-track="select_plan"
      data-track-plan={plan.key}
      data-track-location={location}
      className={linkButtonClass(variant)}
    >
      {t('plan.cta')}
    </Link>
  );

  return (
    <>
      <AudienceJsonLd
        path="/para-corretores"
        homeLabel={tCommon('home')}
        pageLabel={t('meta.breadcrumb')}
        faq={faq}
        offers={[{ name: t('offerName'), priceCents: plan.priceCents, monthly: true }]}
      />

      <AudienceBreadcrumb page={t('meta.breadcrumb')} />

      <div
        className={`${CONTAINER} grid grid-cols-1 gap-10 pt-4 pb-10 md:pt-6 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center`}
      >
        <div className="flex flex-col gap-5">
          <span className="inline-flex self-start rounded-pill bg-fg px-2.5 py-1 type-caption font-semibold text-white">
            {t('tag')}
          </span>
          <h1 className="type-display-xl text-balance">{t('title')}</h1>
          <p className="max-w-[60ch] type-body text-fg-strong">{t('subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#plano" className={linkButtonClass('primary')}>
              {t('ctaPlan')}
            </a>
            <a href="#como-funciona" className={linkButtonClass('secondary')}>
              {t('ctaHow')}
            </a>
          </div>
          <p className="font-mono type-body-s tabular text-fg-strong">{t('summary', summary)}</p>
        </div>
        {appFrame({
          label: t('hero.label'),
          title: t('hero.title'),
          active: 'properties',
          children: (
            <>
              {usage}
              <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
                {BROKER_PROPERTIES.map((p) => (
                  <li key={p.key} className="flex items-center gap-2 p-2">
                    <span className="size-8 shrink-0 rounded-chip bg-ink-100" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.title}</span>
                      <span className="block truncate text-fg-muted">{p.detail}</span>
                    </span>
                    <span className="font-mono font-semibold tabular">
                      {formatPreviewPrice(p.priceCents)}
                    </span>
                    <PreviewStatusPill status={p.status} />
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1 rounded-control border border-line p-2">
                <span className="font-semibold">{t('hero.today')}</span>
                {BROKER_TODAY.map((item) => (
                  <span key={item.key} className="flex justify-between gap-2">
                    <span>{item.who}</span>
                    <span className="font-mono tabular text-fg-muted">{item.time}</span>
                  </span>
                ))}
              </div>
            </>
          ),
        })}
      </div>

      <Section tone="panel" labelledBy="pains-title" className="flex flex-col gap-8">
        <SectionHeading id="pains-title" eyebrow={t('pains.eyebrow')} title={t('pains.title')} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              ['scattered', FolderSearch],
              ['missed', BellOff],
              ['repeated', Repeat],
            ] as const
          ).map(([key, Icon]) => (
            <FeatureCard
              key={key}
              icon={<Icon strokeWidth={1.6} />}
              title={t(`pains.${key}.title`)}
              description={t(`pains.${key}.description`)}
            />
          ))}
        </div>
      </Section>

      <Section id="como-funciona" labelledBy="how-title" className="flex flex-col gap-8">
        <SectionHeading id="how-title" eyebrow={t('how.eyebrow')} title={t('how.title')} />
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [
                'register',
                <dl key="r" className="grid grid-cols-1 gap-1">
                  {(
                    [
                      ['value', formatBRL(BROKER_RECORD.priceCents)],
                      ['area', `${BROKER_RECORD.areaM2} m²`],
                      ['photos', String(BROKER_RECORD.photos)],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-fg-muted">{t(`how.${k}`)}</dt>
                      <dd className="font-mono font-semibold tabular">{v}</dd>
                    </div>
                  ))}
                </dl>,
              ],
              [
                'publish',
                <div key="p" className="flex items-center justify-between gap-2">
                  <span>{t('how.publish.toggle')}</span>
                  {/* Static picture of a switch that is on (not a control). */}
                  <span className="flex h-5 w-9 shrink-0 items-center justify-end rounded-pill bg-action p-0.5">
                    <span className="size-4 rounded-pill bg-white" />
                  </span>
                </div>,
              ],
              [
                'contacts',
                <ul key="c" className="grid grid-cols-1 gap-1">
                  {HOW_CONTACTS.map((c) => (
                    <li key={c.name} className="flex justify-between gap-2">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-fg-muted">{c.source}</span>
                    </li>
                  ))}
                </ul>,
              ],
              [
                'follow',
                <ul key="f" className="grid grid-cols-3 gap-1">
                  {HOW_STAGES.map((s) => (
                    <li key={s.stage} className="flex flex-col rounded-chip bg-subtle p-1">
                      <span className="text-fg-muted">{s.stage}</span>
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-fg-muted">{s.area}</span>
                    </li>
                  ))}
                </ul>,
              ],
            ] as const
          ).map(([key, picture], i) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-card border border-line bg-panel p-5"
            >
              <span aria-hidden="true" className="font-mono type-body-s font-semibold text-action">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="type-body font-semibold">{t(`how.${key}.title`)}</h3>
              <p className="type-body-s text-fg-strong">{t(`how.${key}.description`)}</p>
              <div
                role="img"
                aria-label={t('how.label')}
                className="mt-auto rounded-control border border-line p-2 text-[12px] leading-4"
              >
                <div aria-hidden="true">{picture}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="software-title" className="flex flex-col gap-12">
        <SectionHeading
          id="software-title"
          eyebrow={t('software.eyebrow')}
          title={t('software.title')}
        />
        <SoftwareRow
          title={t('software.record.title')}
          description={t('software.record.description')}
          example={t('software.record.example')}
          picture={appFrame({
            label: t('software.record.label'),
            title: BROKER_RECORD.title,
            active: 'properties',
            children: (
              <div className="grid grid-cols-[1fr_1.4fr] gap-2">
                <span className="flex aspect-square items-center justify-center rounded-chip bg-ink-100 text-action-hover">
                  {t('software.fields.photos', { count: BROKER_RECORD.photos })}
                </span>
                <dl className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ['value', formatBRL(BROKER_RECORD.priceCents)],
                      ['condo', formatBRL(BROKER_RECORD.condoCents)],
                      ['area', `${BROKER_RECORD.areaM2} m²`],
                      ['parking', String(BROKER_RECORD.parking)],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="rounded-chip border border-line p-1.5">
                      <dt className="text-fg-muted">{t(`software.fields.${k}`)}</dt>
                      <dd className="font-mono font-semibold tabular">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="col-span-2 rounded-chip bg-attention-subtle p-2 text-attention-fg">
                  {BROKER_RECORD.note}
                </p>
              </div>
            ),
          })}
        />
        <SoftwareRow
          reverse
          title={t('software.history.title')}
          description={t('software.history.description')}
          example={t('software.history.example')}
          picture={appFrame({
            label: t('software.history.label'),
            title: BROKER_HISTORY.title,
            active: 'contacts',
            children: (
              <ol className="flex flex-col gap-2 border-l border-line pl-3">
                {BROKER_HISTORY.items.map((item) => (
                  <li key={item.key} className="flex gap-3">
                    <span className="font-mono text-fg-muted tabular">{item.date}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ol>
            ),
          })}
        />
        <SoftwareRow
          title={t('software.next.title')}
          description={t('software.next.description')}
          example={t('software.next.example')}
          picture={appFrame({
            label: t('software.next.label'),
            title: t('software.next.screen'),
            active: 'contacts',
            children: (
              <ul className="flex flex-col gap-1.5">
                {BROKER_NEXT_STEPS.map((step) => (
                  <li
                    key={step.key}
                    className="flex items-center justify-between gap-2 rounded-chip border border-line p-2"
                  >
                    <span className="font-semibold">{step.text}</span>
                    <span
                      className={
                        step.urgent
                          ? 'rounded-chip bg-attention-subtle px-1.5 font-mono text-attention-fg tabular'
                          : 'font-mono text-fg-muted tabular'
                      }
                    >
                      {step.when}
                    </span>
                  </li>
                ))}
              </ul>
            ),
          })}
        />
        <SoftwareRow
          reverse
          title={t('software.stages.title')}
          description={t('software.stages.description')}
          example={t('software.stages.example')}
          picture={appFrame({
            label: t('software.stages.label'),
            title: t('software.stages.screen'),
            active: 'opportunities',
            children: (
              <div className="grid grid-cols-4 gap-1.5">
                {BROKER_STAGES.map((column) => (
                  <div
                    key={column.key}
                    className="flex flex-col gap-1 rounded-chip bg-subtle p-1.5"
                  >
                    <span className="text-fg-muted">
                      {column.title} {column.cards.length}
                    </span>
                    {column.cards.map((card) => (
                      <span
                        key={card.name}
                        className="rounded-chip border border-line bg-panel p-1.5"
                      >
                        <span className="block font-semibold">{card.name}</span>
                        <span className="block text-fg-muted">{card.area}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ),
          })}
        />
      </Section>

      <Section tone="panel" labelledBy="portal-title" className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-4">
            <AudienceTag kind="portal" className="self-start">
              {tTags('portal')}
            </AudienceTag>
            <h2 id="portal-title" className="type-display-l text-balance">
              {t('portal.title')}
            </h2>
            <p className="type-body text-fg-strong">
              {t('portal.body', { max: plan.maxActiveProperties })}
            </p>
            <CheckList
              items={[
                t('portal.points.included'),
                t('portal.points.limit', { max: plan.maxActiveProperties }),
                t('portal.points.organized'),
              ]}
            />
            <p className="type-caption">{t('portal.note')}</p>
          </div>
          <PreviewFigure label={t('portal.label')} note={<PreviewNote />}>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {BROKER_PORTAL_LISTINGS.map((l) => (
                  <ListingMini
                    key={l.key}
                    kicker={l.kicker}
                    price={`${formatBRL(l.price.cents)}${l.price.monthly ? '/mês' : ''}`}
                    specs={l.specs}
                    footer={<CreciFooter {...DEMO_BROKER} />}
                  />
                ))}
              </div>
              {usage}
            </div>
          </PreviewFigure>
        </div>
        <TagLegend />
      </Section>

      <Section id="plano" labelledBy="plan-title" className="flex flex-col gap-8">
        <SectionHeading id="plan-title" eyebrow={t('plan.eyebrow')} title={t('plan.title')} />
        <OfferCard
          className="max-w-4xl"
          highlighted
          name={t('plan.name')}
          tags={
            <>
              <AudienceTag kind="software">{tTags('software')}</AudienceTag>
              <AudienceTag kind="portal">{tTags('portal')}</AudienceTag>
            </>
          }
          price={price}
          period={tCommon('perMonth')}
          included={{
            title: t('plan.includes'),
            items: [
              t('plan.included.users', { count: plan.maxUsers }),
              t('plan.included.properties', { count: plan.maxActiveProperties }),
              t('plan.included.register'),
              t('plan.included.contacts'),
              t('plan.included.portal'),
            ],
          }}
          excluded={{
            title: t('plan.excludes'),
            items: [
              t('plan.excluded.highlight'),
              t('plan.excluded.position'),
              t('plan.excluded.campaigns'),
            ],
          }}
          action={signupLink('for_brokers_plan')}
          note={t('plan.note')}
        />
      </Section>

      <Section tone="panel" labelledBy="compare-title" className="flex flex-col gap-8">
        <SectionHeading
          id="compare-title"
          eyebrow={t('compare.eyebrow')}
          title={t('compare.title')}
        />
        <div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <article className="flex flex-col gap-3 rounded-card border border-line bg-panel p-5">
            <h3 className="type-title">{t('compare.oneOff.title')}</h3>
            <p className="type-body-s text-fg-muted">{t('compare.oneOff.subtitle')}</p>
            <CheckList
              items={[
                t('compare.oneOff.items.period', {
                  shortDays: packs[0]!.days,
                  longDays: packs[packs.length - 1]!.days,
                }),
                t('compare.oneOff.items.price', {
                  price: formatBRL(Math.min(...packs.map((p) => p.priceCents))),
                }),
                t('compare.oneOff.items.noSoftware'),
              ]}
            />
            <Link
              href="/anunciar-imovel"
              className="mt-auto inline-flex min-h-11 items-center type-body-s font-semibold text-action hover:underline"
            >
              {t('compare.oneOff.link')} →
            </Link>
          </article>
          <article className="flex flex-col gap-3 rounded-card border-2 border-action bg-panel p-5">
            <h3 className="type-title">{t('compare.subscription.title')}</h3>
            <p className="type-body-s text-fg-muted">{t('compare.subscription.subtitle')}</p>
            <CheckList
              items={[
                t('compare.subscription.items.properties', { max: plan.maxActiveProperties }),
                t('compare.subscription.items.software'),
                t('compare.subscription.items.portal'),
              ]}
            />
            <a
              href="#plano"
              className="mt-auto inline-flex min-h-11 items-center type-body-s font-semibold text-action hover:underline"
            >
              {t('compare.subscription.link')} →
            </a>
          </article>
        </div>
      </Section>

      <FaqSection items={faq} />

      <FinalCta
        title={t('final.title')}
        subtitle={t('final.subtitle', summary)}
        action={signupLink('for_brokers_final', 'attention')}
      />
    </>
  );
}
