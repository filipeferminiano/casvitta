import { cn } from '../lib/cn.ts';

export type AvatarProps = { name: string; size?: 32 | 40 | 48 | 52; className?: string };

const sizes = {
  32: 'size-8 text-[12px]',
  40: 'size-10 text-[14px]',
  48: 'size-12 text-[16px]',
  52: 'size-13 text-[17px]',
};

/** Initials on a neutral circle (no photos of leads are stored). Decorative: the name is shown next to it. */
export function Avatar({ name, size = 40, className }: AvatarProps) {
  const initials = name
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill bg-ink-200 font-semibold text-fg-strong',
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
