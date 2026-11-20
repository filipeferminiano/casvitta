import { getTranslations } from 'next-intl/server';

import { COMPANY, PLANS } from '@/config/site';
import { DEFAULT_LOCALE } from '@/i18n/request';
import { MIN_DAILY_BUDGET_CENTS } from '@/lib/data/ads';
import { formatBRL, formatPhoneBR } from '@/lib/format';
import { requestSite } from '@/lib/request-site';
import { buildLlmsTxt, type LlmsCopy } from '@/lib/llms';

/**
 * /llms.txt (llmstxt.org): a short map of the public site for AI answer engines (GEO).
 * Served on the marketplace host only; prices and limits come from config.
 */
export async function GET() {
  const { site, origin } = await requestSite();
  if (site.kind !== 'marketplace') return new Response('Not found', { status: 404 });

  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'llms' });
  const copy: LlmsCopy = {
    summary: t('summary'),
    intro: t('intro'),
    sections: [
      {
        title: t('sections.buyers.title'),
        links: [
          { path: '/comprar', label: t('nav.buy'), description: t('sections.buyers.buy') },
          { path: '/alugar', label: t('nav.rent'), description: t('sections.buyers.rent') },
        ],
        notes: [t('sections.buyers.listing')],
      },
      {
        title: t('sections.brokers.title'),
        links: [
          {
            path: '/para-corretores',
            label: t('nav.forBrokers'),
            description: t('sections.brokers.forBrokers', {
              essencial: formatBRL(PLANS.essencial.priceCents),
              essencialMax: PLANS.essencial.maxActiveProperties,
              profissional: formatBRL(PLANS.profissional.priceCents),
              profissionalMax: PLANS.profissional.maxActiveProperties,
            }),
          },
        ],
        notes: [t('sections.brokers.media', { minBudget: formatBRL(MIN_DAILY_BUDGET_CENTS) })],
      },
      {
        title: t('sections.owners.title'),
        links: [
          {
            path: '/anunciar-imovel',
            label: t('nav.list'),
            description: t('sections.owners.list'),
          },
        ],
      },
      {
        title: t('sections.interest.title'),
        notes: [t('sections.interest.note')],
        links: [
          {
            path: '/investidores',
            label: t('nav.investors'),
            description: t('sections.interest.investors'),
          },
          {
            path: '/incorporadoras',
            label: t('nav.developers'),
            description: t('sections.interest.developers'),
          },
          { path: '/leilao', label: t('nav.auction'), description: t('sections.interest.auction') },
        ],
      },
      {
        title: t('facts.title'),
        links: [],
        notes: [
          t('facts.creci'),
          t('facts.financing'),
          t('facts.ai'),
          t('facts.contact', { phone: formatPhoneBR(COMPANY.whatsappE164) }),
        ],
      },
      {
        title: t('sections.company.title'),
        links: [
          { path: '/sobre', label: t('sections.company.about') },
          { path: '/privacidade', label: t('sections.company.privacy') },
          { path: '/termos', label: t('sections.company.terms') },
        ],
      },
    ],
  };

  return new Response(buildLlmsTxt(origin, copy), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
