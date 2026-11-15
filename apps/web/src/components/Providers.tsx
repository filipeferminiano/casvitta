'use client';

import { ToastProvider } from '@casvitta/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider closeLabel={t('close')}>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
