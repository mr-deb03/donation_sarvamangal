/**
 * Client for the sarvam_donation_management API (same database as the old donation site).
 *
 * The donation form uses three endpoints added for this app (mobile-number flow, see
 * sarvam_donation_management/src/donor/donor_by_mobile_helpers.js) plus the existing
 * Easebuzz checkout and donation lookup.
 *
 * Every response is wrapped by src/base/responseGenerator.js:
 *   { status: "success" | "error", data, error, errorCode, logUUID }
 */
import { API_BASE_URL } from "@/config";

/**
 * GET /donor/api/v1/get_donor_status_by_mobile/ — nothing personal: no name, PAN, Donor ID
 * or how much they've given (anyone can call it with any number). Asked with an amount, it
 * says whether that gift needs a PAN; creating the donation still enforces it (PAN_REQUIRED).
 */
export interface DonorStatus {
  registered: boolean;
  /** Registered a moment ago; the API's scheduler is still issuing the Donor ID. */
  registration_pending: boolean;
  /**
   * Only when asked with an amount (null otherwise): true when the donor has no PAN on file and
   * this financial year's successful donations plus this amount reach `pan_required_from`.
   * A new donor has given nothing yet, so for them it's amount >= `pan_required_from`.
   */
  pan_required: boolean | null;
  /** e.g. "2026-27" */
  financial_year: string;
  /** ₹ — the public rule: PAN is needed once a donor's gifts this financial year reach this (or more). */
  pan_required_from: number;
}

export type PaymentStatus = "pending" | "success" | "failed";

/** A row of `donation_online`, as returned by GET get_donation_online/:id. */
export interface DonationOnline {
  id: number;
  donor_id: string;
  donor_name: string | null;
  /** The trust's own transaction number — filled by a backend job a few seconds after creation. */
  txn_id: string | null;
  /** Easebuzz's easepayid — filled when the payment webhook arrives. */
  merchant_txn_id: string | null;
  request_date: string | null;
  /** Postgres NUMERIC arrives as a string. */
  txn_amount: string | number | null;
  final_amt: string | null;
  payment_status: PaymentStatus | string;
  purpose_of_donation: string | null;
  payment_mode: string | null;
  remarks: string | null;
  receipt_doc_id: number | null;
  txn_timestamp: string | null;
}

export interface EasebuzzOrder {
  /** Our txnid at Easebuzz (easebuzz_orders.order_id). */
  order_id: string;
  /** The access key from Easebuzz's initiateLink — opens the checkout window. */
  access_key_data: string;
  /** The merchant key — initialises the checkout script. */
  access_key: string;
}

/* ------------------------------------------------------------------ transport */

export type ApiErrorKind = "network" | "timeout" | "server";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** The API's errorCode, e.g. "PAN_REQUIRED". */
  readonly code: string;
  /** What the server said, for the console — never shown to donors as-is. */
  readonly detail: string;

  constructor(kind: ApiErrorKind, status: number, detail: string, code = "") {
    super(detail || kind);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/** Pulls a readable message out of the many shapes the API uses for errors. */
function describeError(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  const pick = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return [o.message, o.detail, o.routine].find((x): x is string => typeof x === "string") ?? "";
    }
    return "";
  };
  return pick(b.error) || pick(b.description) || pick(b.errorCode) || "";
}

interface RequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  // A relative base (the dev mock's "/mock-api") resolves against this site.
  const url = new URL(API_BASE_URL + path, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), opts.timeoutMs ?? 25_000);
  const onOuterAbort = () => controller.abort("cancelled");
  opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new ApiError(controller.signal.aborted ? "timeout" : "network", 0, String(err));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onOuterAbort);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON (proxy error page, empty body) — handled below.
  }

  const envelope = body as { status?: string; data?: unknown; errorCode?: unknown } | null;
  if (!envelope && res.status === 404) {
    // Express's "Cannot GET/POST …" page: this API doesn't have the endpoint (not deployed yet?).
    throw new ApiError("server", 404, `${opts.method ?? "GET"} ${path} not found on ${API_BASE_URL}`, "ROUTE_NOT_FOUND");
  }
  if (!res.ok || !envelope || envelope.status !== "success") {
    const code = typeof envelope?.errorCode === "string" ? envelope.errorCode : "";
    throw new ApiError("server", res.status, describeError(body) || `HTTP ${res.status}`, code);
  }
  return envelope.data as T;
}

/* ------------------------------------------------------------------ endpoints */

/** GET /donor/api/v1/get_donor_status_by_mobile/?mobile=&amount= (amount optional) */
export function getDonorStatus(mobile: string, { amount, signal }: { amount?: number; signal?: AbortSignal } = {}) {
  const query: Record<string, string> = { mobile };
  if (amount) query.amount = String(amount);
  return request<DonorStatus>("/donor/api/v1/get_donor_status_by_mobile/", { query, signal, timeoutMs: 12_000 });
}

/**
 * POST /donor/api/v1/register_donor_by_mobile/ — writes `donors_registration`; the API's
 * scheduler issues the Donor ID a few seconds later. Never registers a mobile twice.
 */
export function registerDonorByMobile(input: {
  first_name: string;
  middle_name: string;
  last_name: string;
  mobile: string;
  pan_no: string | null;
}) {
  return request<{ status: "registered" | "pending" }>("/donor/api/v1/register_donor_by_mobile/", {
    method: "POST",
    body: input,
  });
}

/** Polls the donor status (for this amount, if given) until the scheduler has issued the Donor ID. */
export async function waitForRegistration(
  mobile: string,
  {
    amount,
    signal,
    timeoutMs = 45_000,
    intervalMs = 2_500,
  }: { amount?: number; signal?: AbortSignal; timeoutMs?: number; intervalMs?: number } = {},
): Promise<DonorStatus | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs, signal);
    try {
      const status = await getDonorStatus(mobile, { amount, signal });
      if (status.registered) return status;
    } catch (err) {
      if (signal?.aborted) throw err;
      // A dropped request while polling isn't fatal; try again on the next tick.
    }
  }
  return null;
}

/**
 * POST /donation_online/api/v1/create_donation_by_mobile/ — a pending `donation_online` row.
 * The API enforces the PAN rule (errorCode PAN_REQUIRED). A PAN sent here stays with the
 * donation and reaches the donor's record once the payment succeeds.
 */
export async function createDonationByMobile(input: {
  mobile: string;
  amount: number;
  purpose_of_donation: string;
  pan_no: string | null;
}): Promise<{ id: number; donor_id: string }> {
  const rows = await request<{ id: number; donor_id: string }[]>("/donation_online/api/v1/create_donation_by_mobile/", {
    method: "POST",
    body: input,
  });
  const row = rows?.[0];
  if (!row?.id) throw new ApiError("server", 200, "create_donation_by_mobile returned no id");
  return row;
}

/**
 * POST /payment_integration/api/v1/easebuzz_checkout — asks Easebuzz for an access key and
 * saves the order in `easebuzz_orders`. The API charges the donation's saved amount and
 * refuses a different one (AMOUNT_MISMATCH) or a donation already paid (ALREADY_PAID). When
 * Easebuzz is down, slow or refuses, it answers EASEBUZZ_UNREACHABLE / EASEBUZZ_TIMEOUT /
 * EASEBUZZ_ERROR (HTTP 502) instead of a key.
 * Customer name/email/phone are left to the API's defaults (the trust's own), as the old site did.
 */
export async function startEasebuzzCheckout(input: { donation_online_id: number; amount: number }): Promise<EasebuzzOrder> {
  const order = await request<EasebuzzOrder>("/payment_integration/api/v1/easebuzz_checkout", {
    method: "POST",
    body: input,
    timeoutMs: 40_000,
  });
  // The API doesn't check Easebuzz's own status; on failure `access_key_data` is an error
  // message (or missing) instead of a key.
  if (!order?.access_key || !order.access_key_data || /\s/.test(order.access_key_data)) {
    throw new ApiError("server", 200, `Easebuzz did not return an access key: ${order?.access_key_data ?? "none"}`);
  }
  return order;
}

/** GET /donation_online/api/v1/get_donation_online/:id/ */
export function getDonation(id: number, signal?: AbortSignal) {
  return request<DonationOnline>(`/donation_online/api/v1/get_donation_online/${id}/`, { signal });
}

/* ------------------------------------------------------------------ helpers */

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** A donor-facing sentence for any failed call. In `npm run dev`, the technical cause is added. */
export function friendlyError(err: unknown, action: string): string {
  let message = `Something went wrong while trying to ${action}. Please try again, or call us if it keeps happening.`;
  if (err instanceof ApiError) {
    if (err.kind === "network") message = `We couldn't reach our server to ${action}. Check your internet connection and try again.`;
    if (err.kind === "timeout") message = `Our server took too long to ${action}. Please try again.`;
    // easebuzz_checkout couldn't get a payment window from Easebuzz. No money has moved.
    if (/^EASEBUZZ_(UNREACHABLE|TIMEOUT|ERROR)$/.test(err.code)) {
      message = "Our payment partner, Easebuzz, isn't responding right now. No money has been taken — please try again in a few minutes.";
    }
  }
  return `${message} ${devNote(err)}`.trim();
}

/** In `npm run dev` only, the technical cause, to add to a donor-facing message; "" in a build. */
export function devNote(err: unknown): string {
  return import.meta.env.DEV ? developerHint(err) : "";
}

/** Development only: say what actually failed, and how to fix the usual causes. */
function developerHint(err: unknown): string {
  if (!(err instanceof ApiError)) return `[dev: ${String(err)}]`;
  if (err.code === "ROUTE_NOT_FOUND") {
    return `[dev: ${err.detail}. That API doesn't have the donation-app endpoints yet — deploy the sarvam_donation_management changes, point VITE_API_BASE_URL at a backend that has them, or run "npm run dev:mock".]`;
  }
  return `[dev: ${err.kind} ${err.status || ""} ${err.code || ""} — ${err.detail}. If the API can't reach its database, check sarvam_donation_management/server_config/postgres_config.yaml.]`.replace(/\s+/g, " ");
}

/** Log the technical detail for whoever opens the console; donors see friendlyError(). */
export function logError(context: string, err: unknown) {
  console.error(
    `[donate] ${context}:`,
    err instanceof ApiError ? `${err.kind} ${err.status} ${err.code} ${err.detail}`.replace(/\s+/g, " ") : err,
  );
}
