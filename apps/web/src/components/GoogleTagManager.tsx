import Script from 'next/script';

import { GTM_ID } from '@/config/site';

/**
 * GTM container. Consent Mode v2 defaults are "granted" (product decision: no banner).
 * Renders nothing when NEXT_PUBLIC_GTM_ID is empty (tests, local runs without tracking).
 */
export function GoogleTagManager() {
  if (!GTM_ID) return null;
  const init = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
gtag('js',new Date());
dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`;
  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {init}
      </Script>
      <Script
        id="gtm"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`}
      />
    </>
  );
}

/** <noscript> fallback, first thing in <body>. */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        title="GTM"
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(GTM_ID)}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
