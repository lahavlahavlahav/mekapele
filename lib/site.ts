// =============================================================================
// SITE — canonical URL and names, shared by metadata, sitemap and JSON-LD.
// =============================================================================

export const SITE_URL = "https://www.mekapele.com";
export const SITE_NAME = "מקפלא";
export const SITE_NAME_EN = "Mekapele";
export const SITE_TAGLINE = "מחולל תבניות לפיסול ספרים וקיפול ספרים";
export const SITE_DESCRIPTION =
  "מקפלא הופך כל תמונה, שם או מילה לתבנית פיסול ספרים מדויקת למילימטר: סימון וקיפול (MMF), גזירה וקיפול וצביעה, עם תצוגת 3D חינמית. Book folding pattern generator.";
export const OG_IMAGE = "/og.png";

export const CREATOR = {
  name: "להב ברק",
  alternateName: "Lahav Barak",
  url: `${SITE_URL}/blog/lahav-barak`,
  jobTitle: "אמנית ומנחת סדנאות פיסול ספרים",
  sameAs: ["https://liloubooks.com"],
};

/** Person + Organization + WebSite + WebApplication, for the root layout. */
export function siteJsonLd() {
  const person = {
    "@type": "Person",
    "@id": `${SITE_URL}/#creator`,
    name: CREATOR.name,
    alternateName: CREATOR.alternateName,
    url: CREATOR.url,
    jobTitle: CREATOR.jobTitle,
    sameAs: CREATOR.sameAs,
    knowsAbout: ["פיסול ספרים", "קיפול ספרים", "Book folding art"],
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: SITE_NAME,
        alternateName: SITE_NAME_EN,
        url: SITE_URL,
        logo: `${SITE_URL}/assets/mekapele-logo.png`,
        founder: { "@id": `${SITE_URL}/#creator` },
        sameAs: ["https://liloubooks.com"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: [SITE_NAME_EN, "Mekapele book folding"],
        url: SITE_URL,
        inLanguage: "he",
        publisher: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "WebApplication",
        name: `${SITE_NAME} - ${SITE_TAGLINE}`,
        alternateName: "Mekapele - Book Folding Pattern Generator",
        url: SITE_URL,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        inLanguage: ["he", "en"],
        description: SITE_DESCRIPTION,
        creator: { "@id": `${SITE_URL}/#creator` },
        offers: {
          "@type": "Offer",
          price: "50",
          priceCurrency: "ILS",
          description: "מנוי חודשי - תבניות ללא הגבלה",
        },
      },
    ],
  };
}
