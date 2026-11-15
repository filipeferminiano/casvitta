import { Building2, Megaphone, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { SoonBadge } from '@/components/badges';

import { DeveloperWaitlistForm } from './DeveloperWaitlistForm';

const FRONTS = [
  { key: 'inventory', icon: Building2 },
  { key: 'distribution', icon: Users },
  { key: 'launch', icon: Megaphone },
] as const;

/** Mockup 57: /incorporadoras, "Em breve" + waitlist. Nothing here is presented as available. */
export async function DevelopersScreen() {
  const t = await getTranslations('developers');
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-14 md:px-8 md:pt-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start xl:px-20">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <p className="type-eyebrow">{t('eyebrow')}</p>
          <SoonBadge />
        </div>
        <h1 className="max-w-[22ch] type-display-l md:text-[48px] md:leading-[54px]">
          {t('title')}
        </h1>
        <p className="max-w-[60ch] type-body text-fg-strong">{t('subtitle')}</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {FRONTS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="flex flex-col gap-2 rounded-card border border-line bg-panel p-5"
            >
              <Icon aria-hidden="true" strokeWidth={1.6} className="size-5 text-action" />
              <p className="type-body font-semibold">{t(`fronts.${key}.title`)}</p>
              <p className="type-body-s text-fg-strong">{t(`fronts.${key}.description`)}</p>
            </li>
          ))}
        </ul>
      </div>
      <DeveloperWaitlistForm />
    </div>
  );
}
