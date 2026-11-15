import { base, noRawHex } from '@casvitta/config/eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...base,
  ...nextVitals,
  { ignores: ['.next/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    ...noRawHex,
  },
  {
    // CLAUDE.md §2: UI copy lives in messages/pt-BR.json, never hard-coded in components.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ['·', '—', '/', '|', '•', '›', ' › ', ' ›'],
        },
      ],
    },
  },
];

export default config;
