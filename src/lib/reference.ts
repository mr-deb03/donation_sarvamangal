/**
 * The causes a donor can give to — the main site's four causes plus an open gift.
 *
 * `slug` must match the main site's cause slugs (Sarvamangal → seedCauses / CMS Causes):
 * its Donate links send ?cause=<slug> (donateHref()). `value` is what's saved in
 * donation_online.purpose_of_donation; "General Donation" is the value the API already uses
 * for an open gift. Taglines are the main site's.
 */
export const CAUSES = [
  { slug: "health", value: "Health", label: "Health", tagline: "Care that comes to you" },
  { slug: "education", value: "Education", label: "Education", tagline: "Tools, skills and confidence" },
  { slug: "society", value: "Society", label: "Society", tagline: "Cleaner streets, kinder neighbourhoods" },
  { slug: "spirituality", value: "Spirituality", label: "Spirituality", tagline: "Calm minds, steady hearts" },
  {
    slug: "general",
    value: "General Donation",
    label: "Wherever it's needed most",
    tagline: "We'll put it towards the next camp on the register.",
  },
] as const;

export type Cause = (typeof CAUSES)[number];
export const DEFAULT_CAUSE: Cause = CAUSES[CAUSES.length - 1];

/** ?cause=health / ?cause=Health → the cause; unknown → undefined. */
export function causeFromParam(param: string | null | undefined): Cause | undefined {
  const p = (param ?? "").trim().toLowerCase();
  if (!p) return undefined;
  return CAUSES.find((c) => c.slug === p || c.value.toLowerCase() === p);
}

/** A saved purpose_of_donation → how it reads to a donor. Older values (e.g. "Stationary") pass through. */
export function causeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim().toLowerCase();
  if (v === "general donation") return "General donation";
  return CAUSES.find((c) => c.value.toLowerCase() === v)?.label ?? value;
}

/** Suggested amounts — the main site's donation tiers (Sarvamangal seedDonationTiers). */
export const SUGGESTED_AMOUNTS = [500, 1500, 5000];

/** Fallback for the API's pan_required_above, used until the mobile number is checked. */
export const PAN_REQUIRED_ABOVE = 1000;
