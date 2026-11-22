import { AudienceTagLegend, Badge, Breadcrumbs, FaqList, cn, type FaqItem } from '@casvitta/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { SITE_URL } from '@/config/site';

/** Same container as the header (DEVIATIONS: public pages max 1280 px, 80 px side padding). */
export const CONTAINER = 'mx-auto w-full max-w-7xl px-4 md:px-8 xl:px-20';

export const linkButtonClass = (variant: 'primary' | 'secondary' | 'attention' = 'primary') =>
  cn(
    'inline-flex min-h-11 items-center justify-center rounded-control px-5 text-center type-body-s font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    variant === 'primary' && 'bg-action text-white hover:bg-action-hover',
    variant === 'secondary' && 'border border-fg bg-panel text-fg hover:bg-subtle',
    variant === 'attention' && 'bg-attention text-fg hover:bg-yellow-200',
  );

/** Visible "Início › page" trail, matching the BreadcrumbList each page declares. */
export function AudienceBreadcrumb({ page }: { page: string }) {
  const t = useTranslations('audience.common');
  return (
    <div className={cn(CONTAINER, 'pt-2')}>
      <Breadcrumbs
        label={t('breadcrumbLabel')}
        renderLink={(href, children) => <Link href={href}>{children}</Link>}
        items={[{ label: t('home'), href: '/' }, { label: page }]}
      />
    </div>
  );
}

/** Full-width band; `tone` sets the background. */
export function Section({
  id,
  tone = 'canvas',
  className,
  children,
  labelledBy,
}: {
  id?: string;
  tone?: 'canvas' | 'panel' | 'attention' | 'dark';
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        'scroll-mt-24 border-t border-line py-12 md:py-20',
        tone === 'panel' && 'bg-panel',
        tone === 'attention' && 'border-attention-line bg-attention-subtle',
        tone === 'dark' && 'border-transparent bg-fg text-white',
      )}
    >
      <div className={cn(CONTAINER, className)}>{children}</div>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  className,
}: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex max-w-[40rem] flex-col gap-2', className)}>
      {eyebrow ? <p className="type-eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className="type-display-l text-balance">
        {title}
      </h2>
      {subtitle ? <p className="type-body text-fg-strong">{subtitle}</p> : null}
    </div>
  );
}

/** Visible line under every product preview: the badge for example numbers + "Exemplo ilustrativo". */
export function PreviewNote({ children }: { children?: ReactNode }) {
  const t = useTranslations('audience.preview');
  return (
    <>
      <Badge variant="demo">{t('demo')}</Badge>
      <span>{children ?? t('note')}</span>
    </>
  );
}

export function TagLegend({ className }: { className?: string }) {
  const t = useTranslations('audience.tags');
  return (
    <AudienceTagLegend
      label={t('legendLabel')}
      className={className}
      items={[
        { kind: 'software', tag: t('software'), meaning: t('softwareMeaning') },
        { kind: 'portal', tag: t('portal'), meaning: t('portalMeaning') },
        { kind: 'highlight', tag: t('highlight'), meaning: t('highlightMeaning') },
      ]}
    />
  );
}

export function FaqSection({ items }: { items: FaqItem[] }) {
  const t = useTranslations('audience.common');
  return (
    <Section
      labelledBy="faq-title"
      className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
    >
      <SectionHeading id="faq-title" eyebrow={t('faqEyebrow')} title={t('faqTitle')} />
      <FaqList items={items} defaultOpen />
    </Section>
  );
}

/** Dark closing band with one call to action. */
export function FinalCta({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  action: ReactNode;
}) {
  return (
    <Section
      tone="dark"
      labelledBy="final-cta"
      className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex max-w-[36rem] flex-col gap-2">
        <h2 id="final-cta" className="type-display-l text-balance text-white">
          {title}
        </h2>
        <p className="type-body text-ink-300">{subtitle}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </Section>
  );
}

/** A schema.org Product with one Offer, for each priced offer (never "Sob consulta"). */
export type JsonLdOffer = {
  name: string;
  priceCents: number;
  /** Monthly subscriptions carry a unit price per month. */
  monthly?: boolean;
};

const price = (cents: number) => (cents / 100).toFixed(2);

/**
 * BreadcrumbList, FAQPage (only the questions shown on the page) and Product/Offer for the priced
 * offers, all read from the same config and messages the page renders.
 */
export function AudienceJsonLd({
  path,
  homeLabel,
  pageLabel,
  faq,
  offers,
}: {
  path: string;
  homeLabel: string;
  pageLabel: string;
  faq: FaqItem[];
  offers: JsonLdOffer[];
}) {
  const url = `${SITE_URL}${path}`;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: homeLabel, item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: pageLabel, item: url },
        ],
      },
      // Only pages that show questions declare a FAQPage.
      ...(faq.length
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: faq.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
              })),
            },
          ]
        : []),
      ...offers.map((offer) => ({
        '@type': 'Product',
        name: offer.name,
        brand: { '@id': `${SITE_URL}/#organization` },
        offers: {
          '@type': 'Offer',
          url,
          price: price(offer.priceCents),
          priceCurrency: 'BRL',
          ...(offer.monthly
            ? {
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: price(offer.priceCents),
                  priceCurrency: 'BRL',
                  unitCode: 'MON',
                },
              }
            : {}),
        },
      })),
    ],
  };
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped cannot close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
