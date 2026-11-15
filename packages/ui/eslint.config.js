import { base, noRawHex } from '@casvitta/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';

export default [
  ...base,
  { ignores: ['storybook-static/**', '!.storybook'] },
  reactHooks.configs.flat['recommended-latest'],
  ...storybook.configs['flat/recommended'],
  { files: ['src/**/*.{ts,tsx}'], ignores: ['src/**/*.stories.tsx'], ...noRawHex },
];
