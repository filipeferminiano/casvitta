import type { Metadata } from 'next';

import { AcceptRequestScreen } from '@/screens/broker-accept/AcceptRequestScreen';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AcceptRequestPage() {
  return <AcceptRequestScreen />;
}
