import { EmptyState } from '@casvitta/ui';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { PageHeader } from '@/components/PageHeader';
import { publicUrl, whatsappShare } from '@/lib/share';
import { priceM2Path, TOOL_PATHS, type NavHood } from '@/lib/site-nav';

const TOOLS = [
  { key: 'valuation', path: TOOL_PATHS.valuation },
  { key: 'itbi', path: TOOL_PATHS.itbi },
  { key: 'simulate', path: TOOL_PATHS.simulate },
  { key: 'priceM2', path: TOOL_PATHS.priceM2 },
] as const;

const actionClass =
  'inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-3 type-body-s font-semibold text-fg hover:border-action focus-visible:outline-2 focus-visible:outline-focus';

/** Broker OS · Ferramentas: open the public tools or send them to a client on WhatsApp. */
export async function ToolsScreen({ hoods }: { hoods: NavHood[] }) {
  const t = await getTranslations('appTools');
  const tEmpty = await getTranslations('app.tools');

  const actions = (url: string, shareText: string, name: string) => (
    <div className="flex flex-wrap gap-2">
      <a href={url} target="_blank" rel="noopener" className={actionClass}>
        <ExternalLink aria-hidden="true" strokeWidth={1.6} className="size-4" />
        {t('open')}
        <span className="sr-only">
          {name} ({t('opensNewTab')})
        </span>
      </a>
      <a href={whatsappShare(shareText)} target="_blank" rel="noopener" className={actionClass}>
        <MessageCircle aria-hidden="true" strokeWidth={1.6} className="size-4" />
        {t('share')}
        <span className="sr-only">: {name}</span>
      </a>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ul className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((tool) => {
          const url = publicUrl(tool.path);
          const name = t(`tools.${tool.key}.title`);
          return (
            <li
              key={tool.key}
              className="flex flex-col gap-3 rounded-card border border-line bg-panel p-5"
            >
              <div>
                <h2 className="type-title text-[19px]">{name}</h2>
                <p className="type-body-s text-fg-strong">{t(`tools.${tool.key}.description`)}</p>
              </div>
              {actions(url, t(`tools.${tool.key}.shareText`, { url }), name)}
            </li>
          );
        })}
      </ul>
      <section aria-labelledby="hoods-title" className="flex flex-col gap-3">
        <div>
          <h2 id="hoods-title" className="type-title">
            {t('hoodsTitle')}
          </h2>
          <p className="type-body-s text-fg-muted">{t('hoodsSubtitle')}</p>
        </div>
        {hoods.length ? (
          <ul className="divide-y divide-line rounded-card border border-line bg-panel">
            {hoods.map((h) => {
              const url = publicUrl(priceM2Path(h.slug));
              return (
                <li
                  key={h.slug}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="type-body-s font-semibold">{h.name}</span>
                  {actions(url, t('hoodShareText', { where: h.inName, url }), h.name)}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={tEmpty('emptyTitle')} description={tEmpty('emptyDescription')} />
        )}
      </section>
    </div>
  );
}
