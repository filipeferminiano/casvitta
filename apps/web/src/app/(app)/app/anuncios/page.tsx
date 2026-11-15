import { Megaphone } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('ads');

export default function Page() {
  return <PlaceholderPage page="ads" icon={Megaphone} />;
}
