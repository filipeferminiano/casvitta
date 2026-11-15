'use client';

import { Badge } from '@casvitta/ui';
import { useTranslations } from 'next-intl';

import type { BrokerProfile } from '@/domain/types';

/** Mandatory badges (CLAUDE.md §4) with copy from the catalog. */

export function DemoBadge({ className }: { className?: string }) {
  const t = useTranslations('badges');
  return (
    <Badge variant="demo" className={className}>
      {t('demo')}
    </Badge>
  );
}

export function AiBadge({ className }: { className?: string }) {
  const t = useTranslations('badges');
  return (
    <Badge variant="ai" className={className}>
      {t('ai')}
    </Badge>
  );
}

export function SimulationBadge({ className }: { className?: string }) {
  const t = useTranslations('badges');
  return (
    <Badge variant="simulation" className={className}>
      {t('simulation')}
    </Badge>
  );
}

export function SoonBadge({ className }: { className?: string }) {
  const t = useTranslations('badges');
  return (
    <Badge variant="soon" className={className}>
      {t('soon')}
    </Badge>
  );
}

export function SponsoredBadge({ className }: { className?: string }) {
  const t = useTranslations('badges');
  return (
    <Badge variant="sponsored" className={className}>
      {t('sponsored')}
    </Badge>
  );
}

export function CreciBadge({
  broker,
  className,
}: {
  broker: Pick<BrokerProfile, 'creciState' | 'creciNumber'>;
  className?: string;
}) {
  const t = useTranslations('badges');
  return (
    <Badge variant="creci" className={className}>
      {t('creci', { state: broker.creciState, number: broker.creciNumber })}
    </Badge>
  );
}
