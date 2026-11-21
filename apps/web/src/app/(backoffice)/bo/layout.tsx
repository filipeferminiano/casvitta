import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('backoffice.meta');
  // Never indexed (also X-Robots-Tag in next.config and Disallow in robots.txt for this host).
  return { title: { absolute: t('title') }, robots: { index: false, follow: false } };
}

/** Backoffice, served on admin.casvitta.com.br only (see src/proxy.ts). */
export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return children;
}
