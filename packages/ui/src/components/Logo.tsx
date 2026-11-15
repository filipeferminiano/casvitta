import { cn } from '../lib/cn.ts';
import { LOCKUP, MARK_PATH, WORDMARK_PATH } from './logo-paths.generated.ts';

type Tone = 'ink' | 'white';

const INK = 'var(--color-ink-900)';
const WHITE = 'var(--color-white)';
const DOT = 'var(--color-yellow-400)';

export type LogoProps = {
  /** "ink" on light surfaces, "white" on ink-900. The dot is always yellow. */
  tone?: Tone;
  /** Height in px; width follows the aspect ratio. */
  height?: number;
  className?: string;
  /** Accessible name. Pass null when the logo sits inside a link that already has a name. */
  title?: string | null;
};

function Mark({ color }: { color: string }) {
  return (
    <>
      <path
        d={MARK_PATH}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={66} cy={62} r={9} fill={DOT} />
    </>
  );
}

/** "Casa aberta" mark + CASVITTA wordmark (outlined Familjen Grotesk Bold). */
export function Logo({ tone = 'ink', height = 32, className, title = 'Casvitta' }: LogoProps) {
  const color = tone === 'white' ? WHITE : INK;
  const width = (height * LOCKUP.width) / LOCKUP.height;
  const offset = { x: -13 * LOCKUP.markScale, y: -12 * LOCKUP.markScale };
  return (
    <svg
      viewBox={`0 0 ${LOCKUP.width} ${LOCKUP.height}`}
      width={width}
      height={height}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <g transform={`translate(${offset.x} ${offset.y}) scale(${LOCKUP.markScale})`}>
        <Mark color={color} />
      </g>
      <path
        transform={`translate(${LOCKUP.textX} ${LOCKUP.baselineY})`}
        fill={color}
        d={WORDMARK_PATH}
      />
    </svg>
  );
}

/** The mark alone, for tight spaces (collapsed nav, avatars). */
export function LogoMark({
  tone = 'ink',
  size = 32,
  className,
  title = 'Casvitta',
}: Omit<LogoProps, 'height'> & { size?: number }) {
  return (
    <svg
      viewBox="10 10 80 80"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <Mark color={tone === 'white' ? WHITE : INK} />
    </svg>
  );
}
