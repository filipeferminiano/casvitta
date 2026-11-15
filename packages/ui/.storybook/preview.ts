import type { Preview } from '@storybook/react-vite';

import './storybook.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: {
      options: {
        paper: { name: 'Paper', value: 'var(--color-paper)' },
        surface: { name: 'Surface', value: 'var(--color-surface)' },
        ink: { name: 'Ink 900', value: 'var(--color-ink-900)' },
      },
    },
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
  initialGlobals: { backgrounds: { value: 'paper' } },
};

export default preview;
