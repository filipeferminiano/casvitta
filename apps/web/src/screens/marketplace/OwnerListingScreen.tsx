import { NumberedSteps } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

import { OwnerListingForm } from './OwnerListingForm';

const NEXT = ['contact', 'valuation', 'authorization', 'listing'] as const;

/** Mockup 56: /anunciar-imovel. Stores a request; staff assign a CRECI broker (rule 13). */
export async function OwnerListingScreen() {
  const t = await getTranslations('owner');
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-14 md:px-8 md:pt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start xl:px-20">
      <div className="flex flex-col gap-5">
        <p className="type-eyebrow">{t('eyebrow')}</p>
        <h1 className="max-w-[22ch] type-display-l md:text-[48px] md:leading-[54px]">
          {t('title')}
        </h1>
        <p className="max-w-[60ch] type-body text-fg-strong">{t('subtitle')}</p>
        <h2 className="mt-4 border-b border-line pb-2 type-title">{t('next.title')}</h2>
        <NumberedSteps
          variant="list"
          steps={NEXT.map((key) => ({
            key,
            title: t(`next.${key}.title`),
            description: t(`next.${key}.description`),
          }))}
        />
        <p className="type-caption">{t('note')}</p>
      </div>
      <OwnerListingForm />
    </div>
  );
}
