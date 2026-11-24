/**
 * `npm run dev:mock` only: a stand-in for the Easebuzz window. No money moves. Loaded
 * through a dynamic import behind `import.meta.env.MODE === "mock"`, so production builds
 * never include it.
 */
import { API_BASE_URL } from "@/config";

import type { EasebuzzResponse } from "./easebuzz";

export async function mockCheckout(accessKey: string): Promise<EasebuzzResponse> {
  // Let the button's "Waiting for Easebuzz…" state paint before the blocking dialog.
  await new Promise((r) => setTimeout(r, 400));
  const paid = window.confirm(
    "DEMO PAYMENT — no money moves.\n\nOK: the payment succeeds.\nCancel: the donor closes the payment window.",
  );
  const status = paid ? "success" : "userCancelled";
  await fetch(`${API_BASE_URL}/mock/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_key: accessKey, status }),
  });
  return paid ? { status, mode: "UPI", easepayid: `MOCK${Date.now()}` } : { status };
}
