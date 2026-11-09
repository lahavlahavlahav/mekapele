import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AccessibilityWidget from "@/components/AccessibilityWidget";
import JsonLd from "@/components/JsonLd";
import { CREATOR, OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, siteJsonLd } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - ${SITE_TAGLINE} | Book Folding Pattern Generator`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "פיסול ספרים",
    "קיפול ספרים",
    "תבניות פיסול ספרים",
    "תבנית קיפול ספרים",
    "ספר מקופל",
    "ספר מפוסל",
    "מחולל תבניות",
    "book folding",
    "book folding art",
    "book folding pattern generator",
    "book folding patterns",
  ],
  applicationName: SITE_NAME,
  authors: [{ name: CREATOR.name, url: CREATOR.url }],
  creator: CREATOR.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "he_IL",
    url: "/",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} - ${SITE_TAGLINE}` }],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d2433",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <JsonLd data={siteJsonLd()} />
        <AuthProvider>{children}</AuthProvider>
        <AccessibilityWidget />
      </body>
    </html>
  );
}
