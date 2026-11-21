import { Suspense } from 'react';

import { StaffSignInScreen } from '@/screens/backoffice/StaffSignInScreens';

export default function StaffSignInPage() {
  return (
    <Suspense>
      <StaffSignInScreen />
    </Suspense>
  );
}
