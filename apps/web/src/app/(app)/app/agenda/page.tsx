import { CalendarDays } from 'lucide-react';

import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('calendar');

export default function Page() {
  return <PlaceholderPage page="calendar" icon={CalendarDays} />;
}
