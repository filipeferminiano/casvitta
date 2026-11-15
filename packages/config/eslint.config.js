// Shared flat ESLint config for TypeScript packages.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Raw hex colors are only allowed in the token sources. */
export const noRawHex = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
        message: 'Use design tokens (Tailwind classes) instead of raw hex colors.',
      },
      {
        selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
        message: 'Use design tokens (Tailwind classes) instead of raw hex colors.',
      },
    ],
  },
};

export const base = tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/storybook-static/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);

export default base;
