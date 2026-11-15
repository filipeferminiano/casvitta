import { Building2 } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('properties');

export default function Page() {
  return <PlaceholderPage page="properties" icon={Building2} />;
}
