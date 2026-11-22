import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { isLive } from '@/lib/live';
import { MyPageScreen } from '@/screens/social/MyPageScreen';

export async function generateMetadata() {
  const t = await getTranslations('social.myPage');
  return { title: t('title') };
}

/** Minha página (Casvitta Social). Live API only. */
export default function Page() {
  if (!isLive('social')) notFound();
  return <MyPageScreen />;
}
