import { Callout, NumberedSteps } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

import { AuctionForm } from './AuctionForm';

const GETS = ['match', 'notice', 'broker'] as const;
const RISKS = ['0', '1', '2', '3'] as const;

/** Mockups 59 (desktop) and 60 (mobile): /leilao, interest capture only (rules 11, 13). */
export async function AuctionScreen() {
  const t = await getTranslations('auction');
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 pb-14 md:px-8 md:pt-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-x-12 xl:px-20">
      <section className="flex flex-col gap-4 lg:col-start-1">
        <p className="hidden type-eyebrow md:block">{t('eyebrow')}</p>
        <h1 className="max-w-[22ch] type-display-l text-[30px] leading-9 md:text-[48px] md:leading-[54px]">
          {t('title')}
        </h1>
        <p className="max-w-[60ch] type-body text-fg-strong">
          <span className="md:hidden">{t('subtitleMobile')}</span>
          <span className="hidden md:inline">{t('subtitle')}</span>
        </p>
      </section>

      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <AuctionForm />
      </div>

      <section id="como-funciona" className="flex scroll-mt-20 flex-col gap-5 lg:col-start-1">
        <div className="hidden flex-col gap-2 md:flex">
          <h2 className="border-b border-line pb-2 type-title">{t('gets.title')}</h2>
          <NumberedSteps
            variant="list"
            steps={GETS.map((key) => ({
              key,
              title: t(`gets.${key}.title`),
              description: t(`gets.${key}.description`),
            }))}
          />
        </div>
        <Callout tone="attention" title={t('risk.title')}>
          <ul className="list-disc pl-4">
            {RISKS.map((i) => (
              <li key={i} className="py-0.5">
                {t(`risk.items.${i}`)}
              </li>
            ))}
          </ul>
          <p className="mt-2">{t('risk.lawyer')}</p>
        </Callout>
        <p className="type-caption">{t('notAuctioneer')}</p>
      </section>
    </div>
  );
}
