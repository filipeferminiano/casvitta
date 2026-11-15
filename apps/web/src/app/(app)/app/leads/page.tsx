import { Users } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('leads');

export default function Page() {
  return (
    <PlaceholderPage
      page="leads"
      icon={Users}
      action={{ href: '/anuncios', labelKey: 'emptyAction' }}
    />
  );
}
