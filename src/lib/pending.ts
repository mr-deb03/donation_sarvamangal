/**
 * A payment this browser tab started, kept in sessionStorage so the receipt page can show
 * it after a reload, and "Try again" can refill the form. The receipt page only shows
 * donations found here: the API's get_donation_online/:id is public and ids are
 * sequential, so the page won't turn a guessed link into someone else's name and amount.
 *
 * Holds the donor's own name and mobile for this tab only (sessionStorage is cleared when
 * the tab closes). The PAN is never stored. Every access is guarded: storage can be missing
 * or throw (private mode, blocked storage), and the flow still works within the page.
 */
import type { EasebuzzResponse } from "./easebuzz";

/** What the donor typed, to refill the form on "Try again" / "Make another donation". */
export interface DonorForm {
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
}

export interface PendingPayment {
  donationId: number;
  orderId: string;
  donorId: string;
  donorName: string;
  amount: number;
  /** The saved purpose_of_donation (a cause's `value`). */
  cause: string;
  startedAt: string;
  form: DonorForm;
  gateway?: {
    status: string;
    easepayid?: string;
    mode?: string;
    amount?: string;
    addedon?: string;
    message?: string;
  };
}

const key = (id: number) => `sm-donation:${id}`;
const memory = new Map<number, PendingPayment>();

export function savePending(p: PendingPayment) {
  memory.set(p.donationId, p);
  try {
    sessionStorage.setItem(key(p.donationId), JSON.stringify(p));
  } catch {
    // Storage unavailable — the in-memory copy still serves this page.
  }
}

export function getPending(id: number): PendingPayment | null {
  const inMemory = memory.get(id);
  if (inMemory) return inMemory;
  try {
    const raw = sessionStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as PendingPayment) : null;
  } catch {
    return null;
  }
}

export function recordGatewayResponse(id: number, r: EasebuzzResponse) {
  const p = getPending(id);
  if (!p) return;
  savePending({
    ...p,
    gateway: {
      status: String(r.status ?? "unknown"),
      easepayid: r.easepayid,
      mode: r.mode,
      amount: r.amount,
      addedon: r.addedon,
      message: r.error_Message || r.error,
    },
  });
}
