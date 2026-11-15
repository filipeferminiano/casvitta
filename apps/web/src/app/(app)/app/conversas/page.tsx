import { MessageSquare } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('conversations');

export default function Page() {
  return <PlaceholderPage page="conversations" icon={MessageSquare} />;
}
