/**
 * Easebuzz web checkout (v2), the same script and call the old donation site used
 * (sarvam_donation_management_frontend/src/pages/Payment/EzBuzzCheckout.js).
 * Loaded only when a donor presses Pay, so it costs nothing on first paint.
 */
const SCRIPT_URL = "https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js";

/** The fields of Easebuzz's response we read. It sends more. */
export interface EasebuzzResponse {
  status?: string;
  txnid?: string;
  easepayid?: string;
  amount?: string;
  mode?: string;
  addedon?: string;
  error_Message?: string;
  error?: string;
  [key: string]: unknown;
}

interface EasebuzzCheckoutInstance {
  initiatePayment(options: { access_key: string; onResponse: (r: EasebuzzResponse) => void; theme?: string }): void;
}

declare global {
  interface Window {
    EasebuzzCheckout?: new (merchantKey: string, env: "test" | "prod") => EasebuzzCheckoutInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadEasebuzz(): Promise<void> {
  if (window.EasebuzzCheckout) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.EasebuzzCheckout ? resolve() : reject(new Error("Easebuzz script loaded without EasebuzzCheckout")));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Could not load the Easebuzz checkout script"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Opens the Easebuzz window and resolves with its response once the donor finishes
 * (status "success", "failure", "userCancelled", …). The authoritative result still
 * comes from the API: Easebuzz's webhook updates `donation_online.payment_status`.
 */
export async function openEasebuzzCheckout(opts: {
  merchantKey: string;
  accessKey: string;
  env: "test" | "prod";
}): Promise<EasebuzzResponse> {
  if (import.meta.env.MODE === "mock") {
    const { mockCheckout } = await import("./mock-checkout");
    return mockCheckout(opts.accessKey);
  }
  await loadEasebuzz();
  const Checkout = window.EasebuzzCheckout;
  if (!Checkout) throw new Error("Easebuzz checkout is not available");
  return new Promise((resolve) => {
    new Checkout(opts.merchantKey, opts.env).initiatePayment({
      access_key: opts.accessKey,
      onResponse: resolve,
      theme: "#c8103a",
    });
  });
}

export const isGatewaySuccess = (r: { status?: string } | undefined) => r?.status?.toLowerCase() === "success";

/**
 * Easebuzz hasn't settled the payment yet — e.g. a UPI request still waiting for the bank. Not a
 * failure: the money may still go through, and Easebuzz reports it again when it does (the API
 * keeps the donation pending meanwhile — easebuzz_webhook.js, helpers.isEasebuzzPending).
 */
export const isGatewayPending = (r: { status?: string } | undefined) =>
  ["pending", "initiated"].includes(r?.status?.toLowerCase() ?? "");
