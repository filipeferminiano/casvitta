'use client';

import { Button } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** The page address with "Copiar" (mockup social/10 step 7). */
export function CopyLink({ url }: { url: string }) {
  const t = useTranslations('social.copy');
  const [copied, setCopied] = useState(false);
  const shown = url.replace(/^https?:\/\//, '');
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-control border border-action-line bg-action-subtle p-1 pl-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate font-mono type-body-s text-fg underline-offset-4 hover:underline"
        >
          {shown}
        </a>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {t('copy')}
        </Button>
      </div>
      <p role="status" className="type-caption">
        {copied ? t('copied') : ''}
      </p>
    </div>
  );
}
