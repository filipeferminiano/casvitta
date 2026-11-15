import { LayoutGrid } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('moduleStore');

export default function Page() {
  return <PlaceholderPage page="moduleStore" icon={LayoutGrid} />;
}
