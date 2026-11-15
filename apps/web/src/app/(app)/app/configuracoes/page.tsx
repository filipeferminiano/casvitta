import { Settings } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('settings');

export default function Page() {
  return <PlaceholderPage page="settings" icon={Settings} />;
}
