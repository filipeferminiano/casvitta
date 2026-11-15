import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { SCREENS, screenUrl } from '@/dev/screens';

export const metadata = { robots: { index: false, follow: false } };

/** Dev-only index of every implemented screen with the mockup it reproduces. */
export default async function DevScreensPage() {
  if (process.env.NODE_ENV === 'production' && process.env.SHOW_DEV_SCREENS !== 'true') notFound();
  const t = await getTranslations('devScreens');
  const root = process.env.ROOT_DOMAIN ?? 'localhost:3000';
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <h1 className="type-display-l">{t('title')}</h1>
      <p className="type-body text-fg-strong">{t('description')}</p>
      <table className="w-full border-collapse type-body-s">
        <thead className="bg-canvas">
          <tr>
            <th scope="col" className="border-b border-line px-3 py-2 text-left">
              {t('mockup')}
            </th>
            <th scope="col" className="border-b border-line px-3 py-2 text-left">
              {t('screen')}
            </th>
            <th scope="col" className="border-b border-line px-3 py-2 text-left">
              {t('viewport')}
            </th>
            <th scope="col" className="border-b border-line px-3 py-2 text-left">
              {t('url')}
            </th>
          </tr>
        </thead>
        <tbody>
          {SCREENS.map((s) => {
            const url = screenUrl(s, root);
            return (
              <tr key={s.mockup} className="border-b border-line">
                <td className="px-3 py-2 font-mono">{s.mockup.slice(0, 2)}</td>
                <td className="px-3 py-2">{s.title}</td>
                <td className="px-3 py-2">{t(`viewports.${s.viewport}`)}</td>
                <td className="px-3 py-2">
                  <a href={url} className="font-mono text-action underline underline-offset-2">
                    {url.replace('http://', '')}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="type-caption">{t('states')}</p>
    </main>
  );
}
