import { CircleAlert, CircleCheck, IdCard, LoaderCircle, Lock, UserPlus } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Rupees } from "@/components/ui/Rupees";
import { describedBy, errorId, inputClasses } from "@/components/ui/styles";
import { EASEBUZZ_ENV, mainSite, trust } from "@/config";
import {
  ApiError,
  createDonationByMobile,
  devNote,
  friendlyError,
  getDonorStatus,
  logError,
  registerDonorByMobile,
  startEasebuzzCheckout,
  waitForRegistration,
  type DonorStatus,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { isGatewayPending, isGatewaySuccess, openEasebuzzCheckout } from "@/lib/easebuzz";
import { cleanAmount, displayFinancialYear, financialYearLabel, titleCase } from "@/lib/format";
import { recordGatewayResponse, savePending, type DonorForm } from "@/lib/pending";
import { CAUSES, PAN_REQUIRED_ABOVE, SUGGESTED_AMOUNTS, type Cause } from "@/lib/reference";
import { amountError, cleanDigits, cleanPan, mobileError, nameError, panError } from "@/lib/validation";

import { GiftSummary } from "./GiftSummary";
import { useDonorStatus } from "./useDonorStatus";

type Phase = "idle" | "registering" | "preparing" | "checkout";
type Field = "firstName" | "middleName" | "lastName" | "mobile" | "amount" | "pan" | "declaration";
type Errors = Partial<Record<Field, string>>;

/** Fields in page order, so the first error gets focus. */
const ORDER: Field[] = ["amount", "firstName", "middleName", "lastName", "mobile", "pan", "declaration"];
const FIELD_ID: Record<Field, string> = {
  amount: "don-amount",
  firstName: "don-first",
  middleName: "don-middle",
  lastName: "don-last",
  mobile: "don-mobile",
  pan: "don-pan",
  declaration: "don-declaration",
};

/** A pill — the cause choices and the suggested amounts share it. */
const pill = (on: boolean) =>
  cn(
    "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[0.95rem] font-semibold ring-1 transition-colors ring-inset select-none",
    on ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-ink/20 hover:ring-ink/45",
  );

export interface DonateFormInitial {
  amount: string;
  cause: Cause;
  form: DonorForm;
}

export function DonateForm({ initial }: { initial: DonateFormInitial }) {
  const navigate = useNavigate();
  const [cause, setCause] = useState<Cause>(initial.cause);
  // The amount is either a suggested chip or what's typed in "Other amount" — never both,
  // so typing a new amount can't append to a chip's value.
  const initialIsChip = SUGGESTED_AMOUNTS.includes(Number(initial.amount));
  const [chip, setChip] = useState<number | null>(initialIsChip ? Number(initial.amount) : null);
  const [custom, setCustom] = useState(initialIsChip ? "" : initial.amount);
  const amount = custom || (chip ? String(chip) : "");
  const [form, setForm] = useState<DonorForm>(initial.form);
  const [pan, setPan] = useState("");
  const [declared, setDeclared] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [requestError, setRequestError] = useState("");
  /** Creating the donation answered PAN_REQUIRED for this mobile + amount (the status check
   *  hadn't answered yet, or the year's total changed since). */
  const [serverWantsPan, setServerWantsPan] = useState<{ mobile: string; amount: string } | null>(null);
  const attempt = useRef(0);

  const amountValue = amount && !amountError(amount) ? Number(amount) : 0;
  const { check, panRequired: panForGift, setStatus } = useDonorStatus(form.mobile, amountValue);
  const status: DonorStatus | undefined = check?.state === "ready" ? check.status : undefined;

  const threshold = status?.pan_required_above ?? PAN_REQUIRED_ABOVE;
  const fyLabel = displayFinancialYear(status?.financial_year ?? financialYearLabel());
  // PAN rule — the API decides, from the donor it finds by mobile number: never asked if their
  // record already has a PAN; otherwise asked once this financial year's gifts, this one included,
  // come to more than the threshold (for a new donor: a gift above it). The field appears only when
  // the API has said so — on the mobile check, or on PAN_REQUIRED when the donation is created.
  // The form never guesses: a donor with a PAN on file is never asked.
  const panNeeded = panForGift === true || (serverWantsPan?.mobile === form.mobile && serverWantsPan.amount === amount);

  const busy = phase !== "idle";
  const donorName = titleCase([form.firstName, form.middleName, form.lastName].join(" "));

  const clearError = (field: Field) => errors[field] && setErrors((prev) => ({ ...prev, [field]: undefined }));
  const setField = (field: keyof DonorForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };
  const focusField = (field: Field) =>
    // After the render that shows the field (the PAN field may have just appeared).
    requestAnimationFrame(() => document.getElementById(FIELD_ID[field])?.focus());

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const found: Errors = {
      amount: amountError(amount) || undefined,
      firstName: nameError(form.firstName, "first name") || undefined,
      middleName: nameError(form.middleName, "middle name") || undefined,
      lastName: nameError(form.lastName, "surname") || undefined,
      mobile: mobileError(form.mobile) || undefined,
      pan: (panNeeded && panError(pan)) || undefined,
      declaration: declared ? undefined : "Please tick the declaration to continue.",
    };
    setErrors(found);
    setRequestError("");
    const first = ORDER.find((k) => found[k]);
    if (first) {
      focusField(first);
      return;
    }

    const thisAttempt = ++attempt.current;
    const mobile = form.mobile;
    const amountNumber = Number(amount);
    // Only when it's asked for (it's valid by now). The API keeps it with the donation and adds it
    // to the donor's record once the payment succeeds.
    const panToSend = panNeeded ? pan : null;
    let action = "check your details";

    try {
      // 1. Make sure this mobile number has a Donor ID (the API issues it).
      let known = status;
      if (!known) known = await getDonorStatus(mobile).catch(() => undefined);
      if (!known?.registered) {
        setPhase("registering");
        action = "create your Donor ID";
        const reg = await registerDonorByMobile({
          first_name: form.firstName.trim(),
          middle_name: form.middleName.trim(),
          last_name: form.lastName.trim(),
          mobile,
          pan_no: panToSend,
        });
        if (reg.status === "pending") {
          const ready = await waitForRegistration(mobile, { amount: amountNumber });
          if (!ready) {
            setRequestError(
              "Your details are saved, but your Donor ID is taking longer than usual. Please wait a minute and press Pay again — you won't be registered twice.",
            );
            setPhase("idle");
            return;
          }
          setStatus(ready);
        }
      }

      // 2. The donation. The API checks the PAN rule (PAN_REQUIRED) and keeps the PAN with it.
      setPhase("preparing");
      action = "start your payment";
      let created: { id: number; donor_id: string };
      try {
        created = await createDonationByMobile({
          mobile,
          amount: amountNumber,
          purpose_of_donation: cause.value,
          pan_no: panToSend,
        });
      } catch (err) {
        const handled = handleDonationError(err);
        if (handled) {
          setPhase("idle");
          return;
        }
        throw err;
      }

      // 3. Easebuzz.
      const order = await startEasebuzzCheckout({ donation_online_id: created.id, amount: amountNumber });
      savePending({
        donationId: created.id,
        orderId: order.order_id,
        donorId: created.donor_id,
        donorName,
        amount: amountNumber,
        cause: cause.value,
        startedAt: new Date().toISOString(),
        form,
      });

      setPhase("checkout");
      action = "open the secure payment window";
      const response = await openEasebuzzCheckout({
        merchantKey: order.access_key,
        accessKey: order.access_key_data,
        env: EASEBUZZ_ENV,
      });
      recordGatewayResponse(created.id, response);
      // A response from an attempt the donor abandoned still counts if the money went through — or
      // may still go through (pending): the receipt page then asks them not to pay again.
      if (thisAttempt === attempt.current || isGatewaySuccess(response) || isGatewayPending(response)) {
        navigate(`/receipt/${created.id}`);
      }
    } catch (err) {
      logError(action, err);
      if (thisAttempt === attempt.current) {
        setRequestError(friendlyError(err, action));
        setPhase("idle");
      }
    }

    function handleDonationError(err: unknown): boolean {
      if (!(err instanceof ApiError)) return false;
      logError("create donation", err);
      switch (err.code) {
        case "PAN_REQUIRED":
          setServerWantsPan({ mobile, amount });
          setErrors({ pan: "Please enter your PAN to continue." });
          focusField("pan");
          return true;
        case "INVALID_PAN":
          setErrors({ pan: panError("x") });
          focusField("pan");
          return true;
        case "PAN_BELONGS_TO_ANOTHER_DONOR":
          setErrors({
            pan: `This PAN is registered with a different mobile number. Please use that number, or call us on ${trust.phone}.`,
          });
          focusField("pan");
          return true;
        case "DONOR_NOT_FOUND":
          setRequestError("Your Donor ID isn't ready yet. Please wait a minute and press Pay again.");
          return true;
        default:
          return false;
      }
    }
  }

  function abandonCheckout() {
    attempt.current++;
    setPhase("idle");
  }

  const nameBlur = (field: "firstName" | "middleName" | "lastName", what: string) => () =>
    setErrors((p) => ({ ...p, [field]: (form[field] && nameError(form[field], what)) || undefined }));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <section
        aria-label="Donation form"
        className="rounded-[1.5rem] bg-white p-4 shadow-[0_24px_48px_-36px_rgb(23_25_59/0.45)] ring-1 ring-line sm:p-7"
      >
        <form onSubmit={pay} noValidate>
          <fieldset disabled={busy} className="min-w-0 space-y-6">
            {/* ---------------------------------------------------------- cause */}
            <div role="radiogroup" aria-labelledby="cause-label">
              <GroupLabel id="cause-label">Cause</GroupLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {CAUSES.map((c) => {
                  const selected = c.slug === cause.slug;
                  return (
                    <label
                      key={c.slug}
                      title={c.tagline}
                      className={cn(
                        pill(selected),
                        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-crimson",
                      )}
                    >
                      <input
                        type="radio"
                        name="cause"
                        value={c.slug}
                        checked={selected}
                        onChange={() => setCause(c)}
                        className="sr-only"
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-ink-muted">{cause.tagline}</p>
            </div>

            {/* ---------------------------------------------------------- amount */}
            <div>
              <GroupLabel id="amount-label">Amount</GroupLabel>
              <div className="mt-2.5 flex flex-wrap items-center gap-2" role="group" aria-labelledby="amount-label">
                {SUGGESTED_AMOUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={!custom && chip === n}
                    onClick={() => {
                      setChip(n);
                      setCustom("");
                      clearError("amount");
                    }}
                    className={cn(pill(!custom && chip === n), "tabular")}
                  >
                    <Rupees amount={n} />
                  </button>
                ))}
                <div className="relative w-full min-[400px]:w-44">
                  <span
                    className="rupee pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-muted"
                    aria-hidden
                  >
                    ₹
                  </span>
                  <input
                    id="don-amount"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Other amount, in rupees"
                    value={custom}
                    onChange={(e) => {
                      const next = cleanAmount(e.target.value);
                      setCustom(next);
                      if (next) setChip(null);
                      clearError("amount");
                    }}
                    onBlur={() => custom && setErrors((prev) => ({ ...prev, amount: amountError(custom) || undefined }))}
                    placeholder="Other amount"
                    className={cn(
                      inputClasses(!!errors.amount),
                      "min-h-11 rounded-full pl-9 font-semibold tabular",
                      custom && !errors.amount && "border-ink ring-1 ring-ink",
                    )}
                    {...describedBy("don-amount", { error: errors.amount })}
                  />
                </div>
              </div>
              {errors.amount ? (
                <p id={errorId("don-amount")} className="mt-1.5 text-sm font-medium text-crimson">
                  {errors.amount}
                </p>
              ) : null}
            </div>

            {/* ---------------------------------------------------------- donor */}
            <div className="border-t border-line pt-6">
              <GroupLabel as="h2" required={false}>
                Your details
              </GroupLabel>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
                <TextField
                  id="don-first"
                  label="First name"
                  required
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                  onBlur={nameBlur("firstName", "first name")}
                  error={errors.firstName}
                />
                <TextField
                  id="don-middle"
                  label="Middle name"
                  required
                  autoComplete="additional-name"
                  value={form.middleName}
                  onChange={(e) => setField("middleName", e.target.value)}
                  onBlur={nameBlur("middleName", "middle name")}
                  error={errors.middleName}
                />
                <TextField
                  id="don-last"
                  label="Surname"
                  required
                  autoComplete="family-name"
                  wrapperClassName="col-span-2 sm:col-span-1"
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                  onBlur={nameBlur("lastName", "surname")}
                  error={errors.lastName}
                />

                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="don-mobile" className="mb-1.5 block text-[0.95rem] font-medium text-ink">
                    Mobile number
                    <span className="ml-0.5 text-crimson" aria-hidden>
                      *
                    </span>
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-muted tabular"
                      aria-hidden
                    >
                      +91
                    </span>
                    <input
                      id="don-mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      required
                      maxLength={10}
                      value={form.mobile}
                      onChange={(e) => setField("mobile", cleanDigits(e.target.value, 10))}
                      onBlur={() => form.mobile && setErrors((p) => ({ ...p, mobile: mobileError(form.mobile) || undefined }))}
                      className={cn(inputClasses(!!errors.mobile), "pl-13 tabular")}
                      {...describedBy("don-mobile", {
                        error: errors.mobile,
                        hint: check ? "status" : undefined,
                      })}
                    />
                  </div>
                  {errors.mobile ? (
                    <p id={errorId("don-mobile")} className="mt-1.5 text-sm font-medium text-crimson">
                      {errors.mobile}
                    </p>
                  ) : null}
                </div>

                {panNeeded ? (
                  <TextField
                    id="don-pan"
                    label="PAN"
                    required
                    wrapperClassName="step-enter col-span-2 sm:col-span-1"
                    value={pan}
                    onChange={(e) => {
                      setPan(cleanPan(e.target.value));
                      clearError("pan");
                    }}
                    onBlur={() => pan.length === 10 && setErrors((p) => ({ ...p, pan: panError(pan) || undefined }))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="font-medium tracking-[0.12em] uppercase tabular placeholder:tracking-[0.12em]"
                    error={errors.pan}
                  />
                ) : null}
              </div>

              {errors.mobile ? null : <MobileStatus check={check} />}

              {panNeeded ? (
                <p
                  role="status"
                  className="step-enter mt-3 flex gap-2.5 rounded-xl bg-marigold-soft/50 px-3.5 py-2.5 text-sm leading-relaxed text-ink ring-1 ring-marigold/50"
                >
                  <IdCard className="mt-0.5 size-4 shrink-0 text-crimson-deep" aria-hidden />
                  <span>
                    <span className="font-semibold">PAN needed:</span> with this gift, your donations in this financial
                    year ({fyLabel}) come to more than <Rupees amount={threshold} />, so please provide your PAN — it's
                    required under government guidelines.
                  </span>
                </p>
              ) : null}
            </div>
          </fieldset>

          {/* ------------------------------------------------------------ declaration + pay */}
          <div className="mt-6 border-t border-line pt-5">
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-ink-soft">
              <input
                id="don-declaration"
                type="checkbox"
                checked={declared}
                disabled={busy}
                onChange={(e) => {
                  setDeclared(e.target.checked);
                  if (e.target.checked) clearError("declaration");
                }}
                className="mt-0.5 size-5 shrink-0 accent-crimson"
                {...describedBy("don-declaration", { error: errors.declaration })}
              />
              <span>
                I confirm the information I've entered is true to the best of my knowledge, and that I'm an Indian
                citizen living in India (we can't accept donations from NRIs or from abroad —{" "}
                <a href={mainSite.donations} className="font-medium text-ink underline underline-offset-2">
                  terms
                </a>
                ).
              </span>
            </label>
            {errors.declaration ? (
              <p id={errorId("don-declaration")} className="mt-1.5 pl-8 text-sm font-medium text-crimson">
                {errors.declaration}
              </p>
            ) : null}

            <div aria-live="polite">
              {requestError ? (
                <Alert tone="error" role="alert" className="mt-4">
                  {requestError}
                </Alert>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
                {phase === "registering" ? (
                  "Creating your Donor ID…"
                ) : phase === "preparing" ? (
                  "Setting up your payment…"
                ) : phase === "checkout" ? (
                  "Waiting for Easebuzz…"
                ) : (
                  <>
                    <Lock aria-hidden />
                    {amountValue ? (
                      <span>
                        Pay <Rupees amount={amountValue} /> securely
                      </span>
                    ) : (
                      "Pay securely"
                    )}
                  </>
                )}
              </Button>
              {phase === "checkout" ? (
                <p className="text-sm text-ink-muted">
                  Finish paying in the Easebuzz window. Closed it?{" "}
                  <button type="button" onClick={abandonCheckout} className="font-medium text-crimson underline underline-offset-2">
                    Start again
                  </button>
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  Secure payment by Easebuzz — UPI, cards or net banking.
                  <br className="max-sm:hidden" /> Eligible for 80G tax deduction.
                </p>
              )}
            </div>
          </div>
        </form>
      </section>

      <GiftSummary amount={amountValue || null} cause={cause.label} donorName={donorName} />
    </div>
  );
}

/** Small label above a group of fields (Cause, Amount, Your details). */
function GroupLabel({
  id,
  as: Tag = "p",
  required = true,
  children,
}: {
  id?: string;
  as?: "p" | "h2";
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className="font-sans text-[0.95rem] leading-tight font-semibold text-ink">
      {children}
      {required ? (
        <span className="ml-0.5 text-crimson" aria-hidden>
          *
        </span>
      ) : null}
    </Tag>
  );
}

function MobileStatus({ check }: { check: ReturnType<typeof useDonorStatus>["check"] }) {
  if (!check) return null;
  let icon: ReactNode;
  let text: string;
  if (check.state === "error") {
    icon = <CircleAlert className="size-4 text-crimson-deep" aria-hidden />;
    text = `We couldn't check this number just now. You can still pay — we'll ask for your PAN if it's needed. ${devNote(check.error)}`.trim();
  } else if (check.state === "checking") {
    icon = <LoaderCircle className="size-4 text-ink-muted motion-safe:animate-spin" aria-hidden />;
    text = "Checking this number…";
  } else if (check.status.registered) {
    icon = <CircleCheck className="size-4 text-success" aria-hidden />;
    text = "Welcome back — this number already has a Donor ID. We'll add this gift to it.";
  } else if (check.status.registration_pending) {
    icon = <LoaderCircle className="size-4 text-ink-muted motion-safe:animate-spin" aria-hidden />;
    text = "This number was registered a moment ago — its Donor ID is on its way.";
  } else {
    icon = <UserPlus className="size-4 text-ink-muted" aria-hidden />;
    text = "New here? We'll create your Donor ID when you pay.";
  }
  return (
    <p id="don-mobile-hint" className="mt-2 flex items-start gap-2 text-sm text-ink-muted" aria-live="polite">
      <span className="mt-0.5">{icon}</span>
      <span>{text}</span>
    </p>
  );
}
