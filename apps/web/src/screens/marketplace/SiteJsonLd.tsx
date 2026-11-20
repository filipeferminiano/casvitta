import { getTranslations } from 'next-intl/server';

import { COMPANY, SITE_URL } from '@/config/site';

/**
 * schema.org Organization + WebSite for the marketplace, so search and AI answer engines can
 * identify the brand and use the site search (/comprar?onde=…).
 */
export async function SiteJsonLd() {
  const t = await getTranslations();
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: t('meta.title'),
        url: SITE_URL,
        description: t('llms.summary'),
        areaServed: { '@type': 'Country', name: 'BR' },
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: COMPANY.whatsappE164,
          contactType: 'customer service',
          availableLanguage: 'pt-BR',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: t('meta.title'),
        url: SITE_URL,
        inLanguage: 'pt-BR',
        description: t('meta.description'),
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/comprar?onde={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be inline; the content is our own serialized data, not user HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
