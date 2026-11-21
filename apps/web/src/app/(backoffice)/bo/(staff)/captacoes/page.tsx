import { Suspense } from 'react';

import { CapturesScreen } from '@/screens/backoffice/CapturesScreen';

export default function CapturesPage() {
  return (
    <Suspense>
      <CapturesScreen />
    </Suspense>
  );
}
