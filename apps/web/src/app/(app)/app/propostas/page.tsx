import { FileText } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('proposals');

export default function Page() {
  return <PlaceholderPage page="proposals" icon={FileText} />;
}
