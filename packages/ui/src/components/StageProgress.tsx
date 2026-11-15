import { cn } from '../lib/cn.ts';

export type StageProgressProps = {
  label: string;
  stages: { key: string; label: string }[];
  current: string;
  className?: string;
};

/** Segmented progress bar of a lead's stages; done and current segments in blue. */
export function StageProgress({ label, stages, current, className }: StageProgressProps) {
  const currentIndex = stages.findIndex((s) => s.key === current);
  return (
    <ol
      aria-label={label}
      className={cn('grid gap-1', className)}
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((stage, index) => {
        const done = index <= currentIndex;
        return (
          <li
            key={stage.key}
            aria-current={index === currentIndex ? 'step' : undefined}
            className="flex flex-col gap-2"
          >
            <span
              aria-hidden="true"
              className={cn('h-1.5 rounded-pill', done ? 'bg-action' : 'bg-ink-200')}
            />
            <span
              className={cn(
                'truncate type-caption',
                index === currentIndex
                  ? 'font-semibold text-fg'
                  : done
                    ? 'text-fg'
                    : 'text-fg-muted',
              )}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
