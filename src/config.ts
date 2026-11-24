/** Build-time settings. See .env.example. */

const trimSlash = (s: string) => s.replace(/\/+$/, "");

export const API_BASE_URL = trimSlash(
  import.meta.env.VITE_API_BASE_URL || "https://api-test-donation.sarvamangaleducationtrust.org",
);

export const EASEBUZZ_ENV: "test" | "prod" = import.meta.env.VITE_EASEBUZZ_ENV === "prod" ? "prod" : "test";

export const MAIN_SITE_URL = trimSlash(import.meta.env.VITE_MAIN_SITE_URL || "https://sarvamangaleducationtrust.org");

/** Pages on the main site this app links to. */
export const mainSite = {
  home: `${MAIN_SITE_URL}/`,
  about: `${MAIN_SITE_URL}/about`,
  events: `${MAIN_SITE_URL}/events`,
  contact: `${MAIN_SITE_URL}/contact`,
  privacy: `${MAIN_SITE_URL}/privacy-policy`,
  terms: `${MAIN_SITE_URL}/terms`,
  donations: `${MAIN_SITE_URL}/terms#donations-and-payments`,
};

/**
 * The trust's identity and contact facts.
 * Mirror of the main site's Site settings (Sarvamangal/src/lib/cms/seed/content.ts →
 * seedSettings). If the trust changes them in /admin there, change them here too.
 */
export const trust = {
  name: "Sarvamangal Education Trust",
  wordmarkTop: "Sarvamangal",
  wordmarkBottom: "Education Trust",
  phone: "+91 81081 03856",
  phoneHref: "tel:+918108103856",
  whatsapp: "918108103856",
  email: "sarvamangaledutrust@gmail.com",
  address: [
    "Shop No. 1, Om Niwas (Om Shiv Premises)",
    "Behind Shop No. 1, J.M. Road",
    "Bhandup West, Mumbai, Maharashtra 400078",
  ],
  legal: {
    registrationNo: "E-0038125 (GBR)",
    pan: "ABGTS0900E",
    eightyGNo: "ABGTS0900EF20241",
  },
  /** Confirmed by the owner, Nov 2026 (the Easebuzz account). */
  paymentMethods: ["UPI", "RuPay", "Visa", "Mastercard", "Net banking"],
} as const;

export const whatsappHref = (text: string) => `https://wa.me/${trust.whatsapp}?text=${encodeURIComponent(text)}`;
