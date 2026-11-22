import { getTranslations } from 'next-intl/server';

import { PLANS, planOf } from '@/config/catalog';
import { COMPANY, OFFERS } from '@/config/site';
import { DEFAULT_LOCALE } from '@/i18n/request';
import { MIN_DAILY_BUDGET_CENTS } from '@/lib/data/ads';
import { formatBRL, formatPhoneBR } from '@/lib/format';
import { requestSite } from '@/lib/request-site';
import { buildLlmsTxt, type LlmsCopy } from '@/lib/llms';
import { MARKET_CITY } from '@/screens/marketplace/tool-links';

/**
 * /llms.txt (llmstxt.org): a short map of the public site for AI answer engines (GEO).
 * Served on the marketplace host only; prices and limits come from config.
 */
export async function GET() {
  const { site, origin } = await requestSite();
  if (site.kind !== 'marketplace') return new Response('Not found', { status: 404 });

  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'llms' });
  const tPlans = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'plans' });
  const agency = planOf('agency');
  const packs = OFFERS.ownerPacks;
  const [shortPack, longPack] = [packs[0]!, packs[packs.length - 1]!];
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
              plans: PLANS.filter((plan) => plan.key !== 'agency')
                .map((plan) =>
                  t('sections.brokers.brokerPlan', {
                    name: tPlans(`names.${plan.key}`),
                    price:
                      plan.monthly_cents === 0
                        ? t('free')
                        : t('perMonth', { price: formatBRL(plan.monthly_cents) }),
                    max: plan.limits.active_properties ?? 0,
                  }),
                )
                .join('; '),
            }),
          },
          {
            path: '/para-imobiliarias',
            label: t('nav.forAgencies'),
            description: t('sections.brokers.forAgencies', {
              price: formatBRL(agency.monthly_cents),
              users: agency.limits.users ?? 0,
              extraUser: formatBRL(agency.extra_user_cents ?? 0),
              max: agency.limits.active_properties ?? 0,
            }),
          },
          { path: '/precos', label: t('nav.prices'), description: t('sections.brokers.prices') },
        ],
        notes: [t('sections.brokers.media', { minBudget: formatBRL(MIN_DAILY_BUDGET_CENTS) })],
      },
      {
        title: t('sections.owners.title'),
        links: [
          {
            path: '/anunciar-imovel',
            label: t('nav.list'),
            description: t('sections.owners.list', {
              shortDays: shortPack.days,
              shortPrice: formatBRL(shortPack.priceCents),
              longDays: longPack.days,
              longPrice: formatBRL(longPack.priceCents),
            }),
          },
          {
            path: '/anunciar-imovel/corretor',
            label: t('nav.ownerBroker'),
            description: t('sections.owners.withBroker'),
          },
        ],
      },
      {
        title: t('sections.tools.title'),
        links: [
          {
            path: `/preco-m2/${MARKET_CITY}`,
            label: t('nav.priceM2'),
            description: t('sections.tools.priceM2'),
          },
          {
            path: '/quanto-vale-meu-imovel',
            label: t('nav.valuation'),
            description: t('sections.tools.valuation'),
          },
          {
            path: `/itbi/${MARKET_CITY}`,
            label: t('nav.itbi'),
            description: t('sections.tools.itbi'),
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
