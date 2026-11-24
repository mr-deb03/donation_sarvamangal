import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { cleanAmount } from "@/lib/format";
import type { DonorForm } from "@/lib/pending";
import { causeFromParam, DEFAULT_CAUSE } from "@/lib/reference";
import { amountError } from "@/lib/validation";

import { DonateForm, type DonateFormInitial } from "./DonateForm";

/** Router state from the receipt page ("Try again", "Make another donation"): refill the form. */
export interface DonateLocationState {
  resume?: { form: DonorForm; amount: number | null; cause: string };
}

const EMPTY_FORM: DonorForm = { firstName: "", middleName: "", lastName: "", mobile: "" };

/**
 * The main site's Donate buttons link here with ?amount=1500&cause=health
 * (Sarvamangal → donateHref(), the homepage banner and Give section). Both pre-fill the
 * form and stay editable.
 */
function amountFromLink(params: URLSearchParams): string {
  const a = cleanAmount(params.get("amount") ?? "");
  return a && !amountError(a) ? a : "";
}

export function DonatePage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const resume = (location.state as DonateLocationState | null)?.resume;

  // Read once, on arrival.
  const [initial] = useState<DonateFormInitial>(() => ({
    amount: resume?.amount ? String(resume.amount) : amountFromLink(params),
    cause: causeFromParam(resume ? resume.cause : params.get("cause")) ?? DEFAULT_CAUSE,
    form: resume?.form ?? EMPTY_FORM,
  }));

  return (
    <>
      <title>Donate · Sarvamangal Education Trust</title>
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-14 sm:px-6 sm:pt-10 lg:px-8 lg:pb-20">
        <div className="max-w-3xl">
          <p className="eyebrow text-crimson">Donate online</p>
          <h1 className="mt-2 text-[1.85rem] font-semibold sm:text-[2.3rem]">Donate to Sarvamangal Education Trust</h1>
          <p className="mt-2 max-w-[62ch] text-ink-muted">
            Your gift keeps our camps free — health check-ups, blood drives, notebooks for schoolchildren and career
            guidance.
          </p>
        </div>

        <div className="mt-6">
          <DonateForm initial={initial} />
        </div>
      </div>
    </>
  );
}
