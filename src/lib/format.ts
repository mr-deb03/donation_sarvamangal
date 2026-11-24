const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** 150000 → "1,50,000" (Indian grouping). The ₹ sign comes from <Rupees>. */
export const formatAmount = (n: number) => inr.format(n);

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** India's financial year (1 April – 31 March) as the API labels it: "2026-27". */
export function financialYearLabel(): string {
  const [y, m] = todayInIndia().split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** "2026-27" → "2026–27" for display. */
export const displayFinancialYear = (label: string) => label.replace("-", "–");

/** "2026-11-21" or an ISO timestamp → "21 November 2026". */
export function formatLongDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
}

/** "rammani awadhesh gupta" → "Rammani Awadhesh Gupta". The API stores full names in lower case. */
export function titleCase(s: string | null | undefined): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s.'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export const firstName = (fullName: string | null | undefined) => titleCase(fullName).split(" ")[0] ?? "";

/** Digits only, no leading zeros — for amount inputs. */
export const cleanAmount = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "").slice(0, 8);

/** A NUMERIC from Postgres ("5000.00") or a typed amount → number (NaN-safe). */
export function toAmount(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Easebuzz's payment mode codes (stored lower-case by the API's webhook) → words. */
export function paymentModeLabel(mode: string | null | undefined): string {
  const m = (mode ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    upi: "UPI",
    nb: "Net banking",
    cc: "Credit card",
    dc: "Debit card",
    mw: "Wallet",
    emi: "EMI",
    online: "Online",
  };
  return labels[m] ?? m.toUpperCase();
}
