'use client';

import { Button, Panel } from '@casvitta/ui';
import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect } from 'react';

import { sendPageEvent, sourceFromSearch, whatsappHref } from '@/lib/data/page';

const currentSource = () => sourceFromSearch(new URLSearchParams(window.location.search));

/**
 * "Falar sobre este imóvel" on the broker page (docs/mockups/social/02): opens WhatsApp with the
 * property code. Counts the view and the click; a click is not a message.
 */
export function PropertyWhatsApp({
  slug,
  code,
  whatsappE164,
  brokerName,
  title,
}: {
  slug: string;
  code: string;
  whatsappE164: string | null;
  brokerName: string;
  title: string;
}) {
  const t = useTranslations('social.property');
  useEffect(() => {
    sendPageEvent(slug, 'property_view', currentSource(), code);
  }, [slug, code]);
  const first = brokerName.split(' ')[0] ?? brokerName;
  return (
    <Panel title={t('title')}>
      <p className="mb-4 type-body-s text-fg-strong">{t('intro', { name: first })}</p>
      {whatsappE164 ? (
        <Button asChild className="w-full">
          <a
            href={whatsappHref(whatsappE164, t('message', { name: first, code, title }))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sendPageEvent(slug, 'whatsapp_click', currentSource(), code)}
          >
            <MessageCircle aria-hidden="true" />
            {t('action')}
          </a>
        </Button>
      ) : null}
      <p className="mt-3 type-caption">
        <Link href="/" className="underline underline-offset-4">
          {t('back', { name: first })}
        </Link>
      </p>
    </Panel>
  );
}
