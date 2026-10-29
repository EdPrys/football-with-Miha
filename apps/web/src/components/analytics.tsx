'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { GA_ID, META_PIXEL_ID, captureAttribution, trackPageView } from '@/lib/analytics';

export function Analytics() {
  const pathname = usePathname();
  const firstView = useRef(true);

  useEffect(() => {
    captureAttribution();
    // The pixel snippet counts the first page view itself; GA4 tracks
    // client-side navigation on its own (enhanced measurement).
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    trackPageView();
  }, [pathname]);

  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
          <Script id="ga-init">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {META_PIXEL_ID && (
        <Script id="meta-pixel">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
