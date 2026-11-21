import { Suspense } from 'react';

import { CreciScreen } from '@/screens/backoffice/CreciScreen';

export default function CreciPage() {
  return (
    <Suspense>
      <CreciScreen />
    </Suspense>
  );
}
