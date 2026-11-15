import type { Meta, StoryObj } from '@storybook/react-vite';

import { Logo, LogoMark } from './Logo.tsx';

const meta = { title: 'Brand/Logo', component: Logo } satisfies Meta<typeof Logo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OnLight: Story = { args: { height: 40 } };
export const OnDark: Story = {
  args: { tone: 'white', height: 40 },
  globals: { backgrounds: { value: 'ink' } },
};
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <Logo height={64} />
      <Logo height={32} />
      <Logo height={20} />
      <div className="flex items-center gap-3">
        <LogoMark size={48} />
        <LogoMark size={32} />
        <LogoMark size={16} />
      </div>
    </div>
  ),
};
