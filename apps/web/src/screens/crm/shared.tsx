'use client';

import { Button, EmptyState } from '@casvitta/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ScreenStates } from '@/components/ScreenStates';
import { formatBRLShort, relativeAge } from '@/lib/format';
import { CrmError } from '@/lib/data/crm';

/** Funil and Agenda are in the plan from Essencial: a 403 becomes the upgrade state. */
export function CrmStates<T>({
  query,
  subject,
  feature,
  isEmpty,
  empty,
  children,
}: {
  query: UseQueryResult<T>;
  subject: string;
  feature?: 'pipeline' | 'calendar';
  isEmpty?: (data: T) => boolean;
  empty?: { icon?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode };
  children: (data: NonNullable<T>) => ReactNode;
}) {
  const t = useTranslations('crm.planGate');
  const tPlans = useTranslations('plans.names');
  if (feature && query.error instanceof CrmError && query.error.code === 'feature_not_in_plan') {
    return (
      <EmptyState
        title={t('title', { feature: t(feature), plan: tPlans('essential') })}
        description={t('description', { plan: tPlans('essential') })}
        actions={
          <Button asChild>
            <Link href="/configuracoes">{t('action')}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ScreenStates query={query} subject={subject} isEmpty={isEmpty} empty={empty}>
      {children}
    </ScreenStates>
  );
}

export type ConsentMark = 'granted' | 'none' | 'revoked';

const MARK: Record<ConsentMark, string> = { granted: '●', none: '○', revoked: '✕' };

/** "● Wh ○ In ✕ E-" with a readable label per channel (mockup CR1). */
export function ConsentMarks({
  consent,
}: {
  consent: { whatsapp: ConsentMark; instagram: ConsentMark; email: ConsentMark };
}) {
  const t = useTranslations('crm');
  return (
    <ul className="flex gap-2 type-caption">
      {(['whatsapp', 'instagram', 'email'] as const).map((channel) => {
        const state = consent[channel];
        const label = t(`contacts.consentState.${state}`, { channel: t(`channel.${channel}`) });
        return (
          <li
            key={channel}
            title={label}
            className={
              state === 'granted'
                ? 'text-success'
                : state === 'revoked'
                  ? 'text-danger'
                  : 'text-fg-muted'
            }
          >
            <span aria-hidden="true">
              {MARK[state]} {t(`channel.${channel}`).slice(0, 2)}
            </span>
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

type Interest = {
  purpose: 'buy' | 'rent' | 'sell' | 'let';
  neighborhoods?: string[];
  min_price_cents?: number | null;
  max_price_cents?: number | null;
  min_bedrooms?: number | null;
  min_parking?: number | null;
};

/** "Compra · Cambuí, Taquaral · R$ 600–900 mil · 3 quartos": only what the person said. */
export function useInterestLine() {
  const t = useTranslations('crm');
  return (interest: Interest | null | undefined): string => {
    if (!interest) return '';
    const parts = [t(`purpose.${interest.purpose}`)];
    if (interest.neighborhoods?.length) parts.push(interest.neighborhoods.join(', '));
    const { min_price_cents: min, max_price_cents: max } = interest;
    if (min != null && max != null) {
      parts.push(t('contact.priceRange', { min: formatBRLShort(min), max: formatBRLShort(max) }));
    } else if (max != null) {
      parts.push(t('contact.priceUpTo', { max: formatBRLShort(max) }));
    } else if (min != null) {
      parts.push(t('contact.priceFrom', { min: formatBRLShort(min) }));
    }
    if (interest.min_bedrooms) parts.push(t('contact.bedrooms', { count: interest.min_bedrooms }));
    if (interest.min_parking) parts.push(t('contact.parking', { count: interest.min_parking }));
    return parts.join(' · ');
  };
}

/** Stage label: the broker's name for it, else the default pt-BR name by key. */
export function useStageName() {
  const t = useTranslations('crm.stages');
  return (stage: { key?: string | null; name?: string | null } | null | undefined): string => {
    if (!stage) return '';
    if (stage.name) return stage.name;
    return stage.key ? t(stage.key as 'new') : '';
  };
}

/** Relative time against the real clock (CRM data is live; the demo clock is for fixtures). */
export function useAgo() {
  const t = useTranslations('time');
  return (iso: string) => {
    const age = relativeAge(iso, new Date());
    return t(`ago.${age.key}`, { n: age.n });
  };
}
