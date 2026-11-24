import { BadgeCheck, Lock, MapPin, MessageCircle, Phone } from "lucide-react";

import { Rupees } from "@/components/ui/Rupees";
import { trust, whatsappHref } from "@/config";

/**
 * The page's signature: the gift as a ticket stub (the main site's camp ticket, turned
 * into a receipt). It fills in as the donor types, and becomes the receipt after payment.
 */
export function GiftSummary({ amount, cause, donorName }: { amount: number | null; cause: string; donorName: string }) {
  return (
    <aside aria-label="Your donation summary" className="lg:sticky lg:top-24">
      {/* Phones skip the stub: the Pay button already shows the amount, and the facts sit under it. */}
      <div className="on-ink hidden overflow-hidden rounded-[1.75rem] shadow-[0_24px_48px_-28px_rgb(23_25_59/0.7)] lg:block">
        <div className="px-6 pt-6 pb-7 sm:px-7">
          <p className="eyebrow text-marigold">Your gift</p>
          <p className="mt-2 font-display text-[2.75rem] leading-none font-semibold text-white">
            {amount ? <Rupees amount={amount} /> : <span className="text-ink-200/70">₹ —</span>}
          </p>
          <p className="mt-3 text-[0.95rem]">
            For <span className="font-semibold text-white">{cause}</span>
          </p>
          {donorName ? (
            <p className="mt-1 text-[0.95rem]">
              From <span className="font-semibold text-white">{donorName}</span>
            </p>
          ) : null}
        </div>

        <div className="perforation" aria-hidden />

        <ul className="space-y-3.5 px-6 pt-6 pb-7 text-[0.95rem] sm:px-7">
          <li className="flex gap-3">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-marigold" aria-hidden />
            <span>Eligible for 80G tax deduction.</span>
          </li>
          <li className="flex gap-3">
            <Lock className="mt-0.5 size-5 shrink-0 text-marigold" aria-hidden />
            <span>
              Paid securely through Easebuzz — {trust.paymentMethods.slice(0, -1).join(", ")} or{" "}
              {trust.paymentMethods.at(-1)?.toLowerCase()}.
            </span>
          </li>
          <li className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-marigold" aria-hidden />
            <span>For Indian citizens living in India only — we can't accept donations from NRIs or from abroad.</span>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl bg-white p-5 text-[0.95rem] ring-1 ring-line lg:mt-4">
        <p className="font-semibold text-ink">Need a hand?</p>
        <p className="mt-1 text-ink-muted">Call or message the trust and we'll help you finish.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={trust.phoneHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-medium text-ink ring-1 ring-ink/15 ring-inset hover:bg-paper-2"
          >
            <Phone className="size-4" aria-hidden />
            {trust.phone}
          </a>
          <a
            href={whatsappHref("Namaste! I need help donating online.")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-medium text-ink ring-1 ring-ink/15 ring-inset hover:bg-paper-2"
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
        </div>
      </div>
    </aside>
  );
}
