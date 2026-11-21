import type { ReactNode } from 'react';

import { StaffShell } from '@/screens/backoffice/StaffShell';

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
