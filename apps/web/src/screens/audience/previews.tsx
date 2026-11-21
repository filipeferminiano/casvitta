import { AudienceTag, Badge, PhotoPlaceholder, StatusPill, cn } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { formatBRL } from '@/lib/format';

import type { PreviewStatus } from './preview-data';

/** Compact prices inside product pictures: "R$ 690 mil", "R$ 1,2 mi", "R$ 2.900". */
export function formatPreviewPrice(cents: number): string {
  const reais = cents / 100;
  const nf = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n);
  if (reais >= 1_000_000) return `R$ ${nf(reais / 1_000_000)} mi`;
  if (reais >= 100_000) return `R$ ${nf(reais / 1_000)} mil`;
  return formatBRL(cents);
}

export function PreviewStatusPill({ status }: { status: PreviewStatus }) {
  const t = useTranslations('audience.preview');
  const tone = status === 'published' ? 'success' : status === 'paused' ? 'attention' : 'neutral';
  return (
    <StatusPill tone={tone} className="px-1.5 text-[10px] leading-4">
      {t(status)}
    </StatusPill>
  );
}

/**
 * Small marketplace card for the pictures: owner listings carry "Anúncio do proprietário" (no
 * CRECI, rule 15); broker and agency listings carry the name and the CRECI badge (rule 1).
 */
export function ListingMini({
  kicker,
  price,
  specs,
  footer,
  highlight,
  photoCaption,
  className,
}: {
  kicker: ReactNode;
  price: ReactNode;
  specs: ReactNode;
  footer: ReactNode;
  highlight?: boolean;
  photoCaption?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('audience.preview');
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-card border border-line bg-panel',
        className,
      )}
    >
      <PhotoPlaceholder caption={photoCaption ?? t('photo')} className="aspect-[16/10]">
        {highlight ? (
          <AudienceTag kind="highlight" className="absolute top-2 left-2">
            {t('highlightBadge')}
          </AudienceTag>
        ) : null}
      </PhotoPlaceholder>
      <div className="flex flex-col gap-1 p-3">
        <p className="type-caption">{kicker}</p>
        <p className="font-mono text-[18px] leading-6 font-semibold tabular">{price}</p>
        <p className="type-caption text-fg-strong">{specs}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 type-caption">{footer}</div>
      </div>
    </div>
  );
}

export function OwnerBadge() {
  const t = useTranslations('audience.preview');
  return (
    <span className="inline-flex items-center rounded-chip bg-subtle px-1.5 py-0.5 text-[11px] leading-4 font-semibold text-fg-strong">
      {t('ownerBadge')}
    </span>
  );
}

export function CreciFooter({ name, creci }: { name: string; creci: string }) {
  return (
    <>
      <span className="text-fg-strong">{name}</span>
      <Badge variant="creci">{creci}</Badge>
    </>
  );
}

/** Static picture wrapper for content that is not inside an app frame (listing pictures). */
export function PreviewFigure({
  label,
  note,
  className,
  children,
}: {
  label: string;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div role="img" aria-label={label}>
        <div aria-hidden="true" className="select-none">
          {children}
        </div>
      </div>
      {note ? (
        <figcaption className="flex flex-wrap items-center gap-2 type-caption">{note}</figcaption>
      ) : null}
    </figure>
  );
}
