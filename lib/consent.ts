// Cookie consent for Google Analytics. The choice lives in localStorage under this key
// ("granted" | "denied"); no key = not asked yet, so the banner shows.
export const CONSENT_STORAGE_KEY = "mekapele-cookie-consent";
export const OPEN_CONSENT_EVENT = "mekapele:open-cookie-settings";

export type ConsentChoice = "granted" | "denied";

export function readConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // storage blocked: the choice applies to this page view only
  }
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("consent", "update", { analytics_storage: choice });
}
