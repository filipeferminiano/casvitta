import { Building2 } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';
import { isLive } from '@/lib/live';
import { PropertiesScreen } from '@/screens/crm/PropertiesScreen';

export const generateMetadata = () => placeholderMetadata('properties');

export default function Page() {
  return isLive('crm') ? (
    <PropertiesScreen />
  ) : (
    <PlaceholderPage page="properties" icon={Building2} />
  );
}
