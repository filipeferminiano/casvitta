import Script from 'next/script';

import { GTM_ID } from '@/config/site';

/**
 * GTM container. Consent Mode v2 defaults are "granted" (product decision: no banner).
 * Renders nothing when NEXT_PUBLIC_GTM_ID is empty (tests, local runs without tracking).
 */
export function GoogleTagManager() {
  if (!GTM_ID) return null;
  // Never on the backoffice host (admin.*): staff pages and the data on them stay out of GA.
  const src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  const init = `if(!/^admin\\./.test(location.hostname)){
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
gtag('js',new Date());
dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var s=document.createElement('script');s.async=true;s.src=${JSON.stringify(src)};document.head.appendChild(s);}`;
  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {init}
    </Script>
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
