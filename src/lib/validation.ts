/** Field rules — the same patterns the API checks (donor_by_mobile_helpers.js). */

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** Letters, spaces, dots, apostrophes and hyphens; initials ("K") allowed. */
export const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,49}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;

export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 99_99_999;

/** Uppercase letters and digits only, max 10 — what a PAN field should hold while typing. */
export const cleanPan = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
export const cleanDigits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

export function panError(pan: string): string {
  if (!pan) return "Enter your PAN.";
  if (!PAN_RE.test(pan)) return "A PAN has 10 characters: 5 letters, 4 numbers, then a letter — like ABCDE1234F.";
  return "";
}

export function nameError(value: string, what: string): string {
  const v = value.trim();
  if (!v) return `Enter your ${what}.`;
  if (!NAME_RE.test(v)) return "Use letters only.";
  return "";
}

export function mobileError(value: string): string {
  if (!value) return "Enter your mobile number.";
  if (!MOBILE_RE.test(value)) return "Enter a 10-digit Indian mobile number (starting 6, 7, 8 or 9).";
  return "";
}

export function amountError(raw: string): string {
  if (!raw) return "Enter the amount you'd like to give.";
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_AMOUNT) return "Enter an amount in whole rupees.";
  if (n > MAX_AMOUNT) return "Online donations can be up to ₹99,99,999. For more, please contact us.";
  return "";
}
