import Script from "next/script";

// Google Analytics 4. The ID comes from env NEXT_PUBLIC_GA_ID, else the constant below.
// GA4's enhanced measurement ("page changes based on browser history events", on by
// default) also counts client-side navigations in the App Router.
// Paste the GA4 Measurement ID (G-XXXXXXXXXX) here; empty = analytics off.
const GA_MEASUREMENT_ID = "G-QBJGJQET0E";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
