import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

import { typography } from '@casvitta/config/tokens';

const typeNames = Object.keys(typography);

/** tailwind-merge that knows our custom text sizes, so `text-body` and `text-fg` don't collide. */
const twMerge = extendTailwindMerge<'typography'>({
  extend: {
    classGroups: {
      'font-size': [{ text: typeNames }],
      typography: [{ type: typeNames }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
