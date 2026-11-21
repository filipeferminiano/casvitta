import { Suspense } from 'react';

import { AccountsScreen } from '@/screens/backoffice/AccountsScreens';

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsScreen />
    </Suspense>
  );
}
