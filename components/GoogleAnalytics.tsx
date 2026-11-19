import Script from "next/script";
import { CONSENT_STORAGE_KEY } from "@/lib/consent";

// Google Analytics 4 with Consent Mode v2. analytics_storage starts "denied" (no GA
// cookies) unless the visitor already accepted in CookieBanner; accepting there sends
// gtag('consent','update',{analytics_storage:'granted'}).
// GA4's enhanced measurement ("page changes based on browser history events", on by
// default) also counts client-side navigations in the App Router.
// The ID comes from env NEXT_PUBLIC_GA_ID, else the constant below; empty = analytics off.
const GA_MEASUREMENT_ID = "G-QBJGJQET0E";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
var c=null;try{c=localStorage.getItem('${CONSENT_STORAGE_KEY}');}catch(e){}
gtag('consent','default',{analytics_storage:c==='granted'?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
    </>
  );
}
