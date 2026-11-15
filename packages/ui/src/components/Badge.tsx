import { cva, type VariantProps } from 'class-variance-authority';
import { Sparkles } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn.ts';

/**
 * Mandatory badges (DESIGN_SYSTEM.md §5). Text comes from the caller (message catalog), so
 * the copy lives in one place; the look is fixed here.
 *
 * - demo: any is_demo record or example number ("Demonstrativo")
 * - creci: every listing, ad creative, landing page and broker card ("CRECI-SP 000.000-F")
 * - ai: every AI-generated text ("Feito por IA")
 * - simulation: every financing number ("Simulação · não é aprovação")
 * - soon: future modules ("Em breve")
 * - sponsored: sponsored marketplace listings ("Destaque pago")
 */
export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip align-middle',
  {
    variants: {
      variant: {
        demo: 'bg-attention px-1.5 py-0.5 text-[11px] leading-4 font-bold tracking-[0.04em] text-fg uppercase',
        creci: 'border border-fg px-1.5 py-px font-mono text-[12px] leading-4 tabular text-fg',
        ai: 'bg-action-subtle px-1.5 py-0.5 text-[12px] leading-4 font-medium text-action-hover',
        simulation: 'bg-subtle px-1.5 py-0.5 text-[12px] leading-4 font-medium text-fg-muted',
        soon: 'rounded-pill bg-subtle px-2 py-0.5 text-[12px] leading-4 font-medium text-fg-muted',
        sponsored: 'bg-fg px-1.5 py-0.5 text-[12px] leading-4 font-semibold text-white',
      },
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export type BadgeProps = ComponentProps<'span'> & { variant: BadgeVariant };

export function Badge({ variant, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === 'ai' ? (
        <Sparkles aria-hidden="true" strokeWidth={1.6} className="size-3.5" />
      ) : null}
      {children}
    </span>
  );
}
