import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, MoreHorizontal, Send } from 'lucide-react';

import { IconButton } from './IconButton.tsx';

const meta = {
  title: 'Foundations/IconButton',
  component: IconButton,
  args: { label: 'Mais ações', icon: <MoreHorizontal strokeWidth={1.6} /> },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ghost: Story = {};
export const Secondary: Story = {
  args: { variant: 'secondary', label: 'Notificações', icon: <Bell strokeWidth={1.6} /> },
};
export const Primary: Story = {
  args: { variant: 'primary', label: 'Enviar mensagem', icon: <Send strokeWidth={1.6} /> },
};
export const Small: Story = { args: { size: 'sm' } };
export const Disabled: Story = { args: { disabled: true } };
