import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ConfirmLinkScreen } from '@/screens/signup/ConfirmLinkScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signIn.confirm');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default function Page() {
  return <ConfirmLinkScreen />;
}
