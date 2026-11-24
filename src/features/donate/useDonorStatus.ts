import { useEffect, useState } from "react";

import { getDonorStatus, logError, type DonorStatus } from "@/lib/api";
import { MOBILE_RE } from "@/lib/validation";

export type MobileCheck =
  | { mobile: string; state: "checking" }
  | { mobile: string; state: "ready"; status: DonorStatus }
  | { mobile: string; state: "error"; error: unknown };

interface Answer {
  mobile: string;
  /** The amount asked about (0 = none yet). */
  amount: number;
  status: DonorStatus;
}

/**
 * Checks the mobile number with the API once it's a valid 10-digit number (debounced), with the
 * amount chosen: is the donor new (so needs a Donor ID first), and does this gift need a PAN?
 * Only the API knows this financial year's total and whether a PAN is on file — the form never
 * sees either. Asked again whenever the mobile number or the amount changes.
 *
 * - `check`: for the line under the mobile field. Changing only the amount keeps the answer
 *   already shown for this number.
 * - `panRequired`: for this number and amount. While a new amount is being checked, the last
 *   answer for this number stands, so the PAN field doesn't flicker. `undefined` when unknown —
 *   creating the donation still enforces the rule (PAN_REQUIRED).
 */
export function useDonorStatus(mobile: string, amount: number) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, setAsking] = useState<{ mobile: string; amount: number; failed: boolean; error?: unknown } | null>(null);
  const valid = MOBILE_RE.test(mobile);

  useEffect(() => {
    if (!valid) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setAsking({ mobile, amount, failed: false });
      getDonorStatus(mobile, { amount, signal: ctrl.signal })
        .then((status) => {
          if (ctrl.signal.aborted) return;
          setAnswer({ mobile, amount, status });
          setAsking(null);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          logError("donor status", err);
          setAsking({ mobile, amount, failed: true, error: err });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [mobile, amount, valid]);

  const forMobile = valid && answer?.mobile === mobile ? answer : null;
  const askingNow = valid && asking?.mobile === mobile ? asking : null;

  let check: MobileCheck | null = null;
  if (forMobile) check = { mobile, state: "ready", status: forMobile.status };
  else if (askingNow?.failed) check = { mobile, state: "error", error: askingNow.error };
  else if (askingNow) check = { mobile, state: "checking" };

  const failedForAmount = !!askingNow && askingNow.amount === amount && askingNow.failed;
  const panRequired = forMobile && amount && !failedForAmount ? (forMobile.status.pan_required ?? undefined) : undefined;

  return {
    check,
    panRequired,
    /** After registering: the fresh status (asked with the same amount) for this number. */
    setStatus: (status: DonorStatus) => setAnswer({ mobile, amount, status }),
  };
}
