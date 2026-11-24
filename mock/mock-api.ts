/**
 * `npm run dev:mock` — an in-memory stand-in for the sarvam_donation_management endpoints
 * this app uses, so the form can be tried without a backend or database. Dev server only;
 * never part of a build. Rules and response shapes mirror the real handlers
 * (src/donor/donor_by_mobile_helpers.js and friends). Data resets when the server restarts.
 *
 * Try:  9876543210 — returning donor, ₹600 given this year, no PAN (₹400 more asks for PAN; ₹399 doesn't)
 *       9811111111 — returning donor with PAN on file (never asked)
 *       any other  — new donor (Donor ID issued ~3 s after registering, like the scheduler)
 *
 * Like the real API: a PAN given with a donation stays on it and reaches the donor only when
 * the (simulated) payment succeeds; registration never stores a PAN; the status check says
 * nothing personal beyond whether the amount asked about needs a PAN; checkout charges the
 * donation's own amount.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { Plugin } from "vite";

const PAN_REQUIRED_FROM = 1000;
const MOBILE_RE = /^[6-9]\d{9}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,49}$/;

interface Donor {
  donorId: string;
  name: string;
  mobile: string;
  pan: string | null;
}
interface Donation {
  id: number;
  donorId: string;
  amount: number;
  cause: string;
  date: string;
  status: "pending" | "success" | "failed";
  /** PAN given with this donation — copied to the donor once paid (applyDonationPan). */
  pan: string | null;
  accessKey?: string;
  mode?: string;
  easepayid?: string;
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
function financialYear() {
  const [y, m] = today().split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return { start: `${start}-04-01`, label: `${start}-${String((start + 1) % 100).padStart(2, "0")}` };
}

export function mockApi(): Plugin {
  let donorSeq = 1;
  let donationSeq = 1000;
  const donors = new Map<string, Donor>();
  const pendingRegs = new Map<string, { readyAt: number; name: string }>();
  const donations = new Map<number, Donation>();

  const addDonor = (mobile: string, name: string, pan: string | null) => {
    const donor = { donorId: `SET023A${String(donorSeq++).padStart(6, "0")}`, name: name.toLowerCase(), mobile, pan };
    donors.set(mobile, donor);
    return donor;
  };
  const asha = addDonor("9876543210", "Asha K Rao", null);
  donations.set(donationSeq, { id: donationSeq++, donorId: asha.donorId, amount: 600, cause: "Health", date: today(), status: "success", pan: null });
  addDonor("9811111111", "Ravi S Iyer", "ABCPD1234F");

  /** The scheduler: registrations become donors after a few seconds. */
  const runScheduler = () => {
    for (const [mobile, reg] of pendingRegs) {
      if (reg.readyAt <= Date.now()) {
        addDonor(mobile, reg.name, null);
        pendingRegs.delete(mobile);
      }
    }
  };
  const findDonor = (mobile: string, pan: string | null) =>
    donors.get(mobile) ?? (pan ? [...donors.values()].find((d) => d.pan === pan) : undefined);
  const fyTotal = (donorId: string) =>
    [...donations.values()]
      .filter((d) => d.donorId === donorId && d.status === "success" && d.date >= financialYear().start)
      .reduce((sum, d) => sum + d.amount, 0);
  /** helpers.panRequired: no PAN on file and this year's total plus this gift reach the threshold. */
  const panRequired = (donor: Donor | undefined, amount: number) =>
    !donor?.pan && (donor ? fyTotal(donor.donorId) : 0) + amount >= PAN_REQUIRED_FROM;

  function send(res: ServerResponse, code: number, data: unknown, errorCode: string | 0 = 0, error: string | null = null) {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: code < 300 ? "success" : "error", data, error, errorCode, logUUID: null }));
  }

  async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    runScheduler();
    const url = new URL(req.url ?? "/", "http://mock");
    const path = url.pathname.replace(/\/+$/, "");
    const body = req.method === "POST" ? await readBody(req) : {};
    const str = (k: string) => String(body[k] ?? "").trim();

    if (req.method === "GET" && path === "/donor/api/v1/get_donor_status_by_mobile") {
      const mobile = (url.searchParams.get("mobile") ?? "").replace(/\D/g, "").slice(-10);
      if (!MOBILE_RE.test(mobile)) return send(res, 400, null, "INVALID_MOBILE", "Enter a valid 10-digit mobile number");
      const amountParam = url.searchParams.get("amount");
      const amount = Number(amountParam);
      if (amountParam && (!Number.isInteger(amount) || amount < 1 || amount > 9999999)) {
        return send(res, 400, null, "INVALID_AMOUNT", "Enter an amount in whole rupees");
      }
      const donor = donors.get(mobile);
      return send(res, 200, {
        registered: !!donor,
        registration_pending: !donor && pendingRegs.has(mobile),
        pan_required: amountParam ? panRequired(donor, amount) : null,
        financial_year: financialYear().label,
        pan_required_from: PAN_REQUIRED_FROM,
      });
    }

    if (req.method === "POST" && path === "/donor/api/v1/register_donor_by_mobile") {
      const [first, middle, last] = [str("first_name"), str("middle_name"), str("last_name")];
      const mobile = str("mobile");
      const pan = str("pan_no").toUpperCase() || null;
      if (![first, middle, last].every((n) => NAME_RE.test(n))) {
        return send(res, 400, null, "INVALID_NAME", "First name, middle name and surname are required, and names can use letters only");
      }
      const names = [first, middle, last];
      if (!MOBILE_RE.test(mobile)) return send(res, 400, null, "INVALID_MOBILE", "Enter a valid 10-digit mobile number");
      if (pan && !PAN_RE.test(pan)) return send(res, 400, null, "INVALID_PAN", "PAN must be in the format ABCDE1234F");
      if (findDonor(mobile, pan)) return send(res, 200, { status: "registered" });
      // The PAN only finds an existing donor; it isn't stored with a new registration.
      if (!pendingRegs.has(mobile)) pendingRegs.set(mobile, { readyAt: Date.now() + 3000, name: names.join(" ") });
      return send(res, 200, { status: "pending" });
    }

    if (req.method === "POST" && path === "/donation_online/api/v1/create_donation_by_mobile") {
      const mobile = str("mobile");
      const amount = Number(body.amount);
      const pan = str("pan_no").toUpperCase() || null;
      if (!MOBILE_RE.test(mobile)) return send(res, 400, null, "INVALID_MOBILE", "Enter a valid 10-digit mobile number");
      if (!Number.isInteger(amount) || amount < 1 || amount > 9999999) return send(res, 400, null, "INVALID_AMOUNT", "Enter an amount in whole rupees");
      if (pan && !PAN_RE.test(pan)) return send(res, 400, null, "INVALID_PAN", "PAN must be in the format ABCDE1234F");
      const donor = findDonor(mobile, pan);
      if (!donor) return send(res, 404, null, "DONOR_NOT_FOUND", "No Donor ID for this mobile number yet");
      if (panRequired(donor, amount) && !pan) return send(res, 400, { pan_required: true, financial_year: financialYear().label }, "PAN_REQUIRED", "PAN is required");
      const carriedPan = pan && !donor.pan ? pan : null;
      if (carriedPan && [...donors.values()].some((d) => d !== donor && d.pan === carriedPan)) {
        return send(res, 409, null, "PAN_BELONGS_TO_ANOTHER_DONOR", "This PAN is registered with a different mobile number");
      }
      const id = donationSeq++;
      const cause = str("purpose_of_donation") || "General Donation";
      donations.set(id, { id, donorId: donor.donorId, amount, cause, date: today(), status: "pending", pan: carriedPan });
      return send(res, 200, [{ id, donor_id: donor.donorId, txn_amount: String(amount), purpose_of_donation: cause }]);
    }

    if (req.method === "POST" && path === "/payment_integration/api/v1/easebuzz_checkout") {
      const donation = donations.get(Number(body.donation_online_id));
      if (!donation) return send(res, 404, null, "DONATION_NOT_FOUND", "Donation not found");
      if (donation.status === "success") return send(res, 409, null, "ALREADY_PAID", "This donation has already been paid");
      if (Number(body.amount) !== donation.amount) return send(res, 400, null, "AMOUNT_MISMATCH", "The amount doesn't match the donation");
      donation.accessKey = `mockaccesskey${donation.id}`;
      return send(res, 200, { order_id: `MOCKORD${donation.id}`, access_key_data: donation.accessKey, access_key: "MOCKMERCHANT" });
    }

    // The simulated checkout reports the outcome here — the real API learns it from Easebuzz's webhook.
    if (req.method === "POST" && path === "/mock/pay") {
      const donation = [...donations.values()].find((d) => d.accessKey === str("access_key"));
      if (donation && str("status") === "success") {
        Object.assign(donation, { status: "success", mode: "upi", easepayid: `E${Date.now()}` });
        // applyDonationPan: now it's paid, the donor gets the donation's PAN if they have none.
        const donor = [...donors.values()].find((d) => d.donorId === donation.donorId);
        if (donor && !donor.pan && donation.pan && ![...donors.values()].some((d) => d !== donor && d.pan === donation.pan)) {
          donor.pan = donation.pan;
        }
      }
      return send(res, 200, null);
    }

    const m = path.match(/^\/donation_online\/api\/v1\/get_donation_online\/(\d+)$/);
    if (req.method === "GET" && m) {
      const d = donations.get(Number(m[1]));
      if (!d) return send(res, 404, null, "Record not found");
      const donor = [...donors.values()].find((x) => x.donorId === d.donorId);
      return send(res, 200, {
        id: d.id,
        donor_id: d.donorId,
        donor_name: donor?.name ?? null,
        txn_id: `MOCK/${d.id}`,
        merchant_txn_id: d.easepayid ?? null,
        request_date: d.date,
        txn_amount: String(d.amount),
        final_amt: null,
        payment_status: d.status,
        purpose_of_donation: d.cause,
        payment_mode: d.mode ?? null,
        remarks: null,
        receipt_doc_id: null,
        txn_timestamp: null,
      });
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html");
    res.end(`<pre>Cannot ${req.method} ${path} (mock API)</pre>`);
  }

  return {
    name: "sarvamangal-mock-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/mock-api", (req, res) => {
        setTimeout(() => void handle(req, res), 350); // feel like a network
      });
    },
  };
}
