import { House } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('home');

export default function Page() {
  return (
    <PlaceholderPage
      page="home"
      icon={House}
      action={{ href: '/anuncios', labelKey: 'emptyAction' }}
    />
  );
}
