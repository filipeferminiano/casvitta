import { Settings } from 'lucide-react';

import { SignOutButton } from '@/components/app-shell/SignOutButton';
import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

export const generateMetadata = () => placeholderMetadata('settings');

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PlaceholderPage page="settings" icon={Settings} />
      <div className="self-start">
        <SignOutButton />
      </div>
    </div>
  );
}
