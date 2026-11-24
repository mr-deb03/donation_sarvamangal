import { ArrowLeft, Download, LoaderCircle, MessageCircle, Printer, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";

import { Alert } from "@/components/ui/Alert";
import { Button, LinkButton } from "@/components/ui/Button";
import { Rupees } from "@/components/ui/Rupees";
import { mainSite, trust, whatsappHref } from "@/config";
import type { DonateLocationState } from "@/features/donate/DonatePage";
import type { Acknowledgement } from "@/lib/acknowledgement-pdf";
import { getDonation, logError, sleep, type DonationOnline } from "@/lib/api";
import { cn } from "@/lib/cn";
import { isGatewayPending, isGatewaySuccess } from "@/lib/easebuzz";
import { firstName, formatLongDate, paymentModeLabel, titleCase, toAmount, todayInIndia } from "@/lib/format";
import { getPending, type PendingPayment } from "@/lib/pending";
import { causeLabel } from "@/lib/reference";

/**
 * How long to keep asking the API. Easebuzz's webhook writes `easebuzz_payments`, and the
 * API's scheduler copies the result into `donation_online` every 5 seconds.
 */
const POLL_FOR_MS = 90_000;
const POLL_EVERY_MS = 3_000;

type Outcome = "confirmed" | "confirming" | "received" | "failed" | "checking" | "unknown";

export function ReceiptPage() {
  const { donationId } = useParams();
  const id = Number(donationId);
  const pending = useMemo(() => (Number.isInteger(id) && id > 0 ? getPending(id) : null), [id]);

  if (!pending) return <NoReceipt />;
  return <Receipt id={id} pending={pending} />;
}

function Receipt({ id, pending }: { id: number; pending: PendingPayment }) {
  const navigate = useNavigate();
  const [record, setRecord] = useState<DonationOnline | null>(null);
  const [polling, setPolling] = useState(true);
  const [round, setRound] = useState(0);
  const [pdfState, setPdfState] = useState<"idle" | "busy" | "failed">("idle");

  const gateway = pending.gateway;
  const gatewayPaid = isGatewaySuccess(gateway);
  // "pending" from Easebuzz isn't a failure: the bank may still approve it, so the page keeps
  // checking and tells the donor not to pay again rather than offering "Try again".
  const gatewayFailed = !!gateway && !gatewayPaid && !isGatewayPending(gateway);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const deadline = Date.now() + POLL_FOR_MS;
      while (!ctrl.signal.aborted) {
        try {
          const r = await getDonation(id, ctrl.signal);
          setRecord(r);
          const status = String(r.payment_status).toLowerCase();
          if (status === "success" || status === "failed" || gatewayFailed) break;
        } catch (err) {
          if (ctrl.signal.aborted) return;
          logError("donation status", err);
        }
        if (Date.now() > deadline) break;
        try {
          await sleep(POLL_EVERY_MS, ctrl.signal);
        } catch {
          return;
        }
      }
      if (!ctrl.signal.aborted) setPolling(false);
    })();
    return () => ctrl.abort();
  }, [id, gatewayFailed, round]);

  const serverStatus = String(record?.payment_status ?? "pending").toLowerCase();
  const outcome: Outcome =
    serverStatus === "success"
      ? "confirmed"
      : serverStatus === "failed" || gatewayFailed
        ? "failed"
        : gatewayPaid
          ? polling
            ? "confirming"
            : "received"
          : polling
            ? "checking"
            : "unknown";

  const donorName = titleCase(record?.donor_name) || pending.donorName;
  const ack: Acknowledgement = {
    status: outcome === "confirmed" ? "confirmed" : "received",
    donorName,
    donorId: record?.donor_id || pending.donorId,
    date: formatLongDate(record?.request_date || todayInIndia()),
    cause: causeLabel(record?.purpose_of_donation || pending.cause),
    mode: paymentModeLabel(record?.payment_mode || gateway?.mode),
    amount: toAmount(record?.txn_amount) || pending.amount,
    easebuzzId: record?.merchant_txn_id || gateway?.easepayid || undefined,
    trustTxnId: record?.txn_id || undefined,
    reference: pending.orderId,
  };

  const retry = () =>
    navigate("/", {
      state: { resume: { form: pending.form, amount: pending.amount, cause: pending.cause } } satisfies DonateLocationState,
    });
  const donateAgain = () =>
    navigate("/", { state: { resume: { form: pending.form, amount: null, cause: pending.cause } } satisfies DonateLocationState });

  async function download() {
    setPdfState("busy");
    try {
      const { downloadAcknowledgementPdf } = await import("@/lib/acknowledgement-pdf");
      await downloadAcknowledgementPdf(ack);
      setPdfState("idle");
    } catch (err) {
      logError("acknowledgement PDF", err);
      setPdfState("failed");
    }
  }

  const name = firstName(donorName);
  const contactLine = (
    <>
      call <a href={trust.phoneHref} className="font-medium text-ink underline underline-offset-2">{trust.phone}</a> or{" "}
      <a href={whatsappHref(`Namaste! About my donation, reference ${pending.orderId}.`)} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
        WhatsApp us
      </a>{" "}
      and quote reference <strong className="font-semibold text-ink tabular">{pending.orderId}</strong>
    </>
  );

  return (
    <Page title={outcome === "failed" ? "Payment not completed" : "Thank you"}>
      {outcome === "checking" ? (
        <Heading eyebrow="One moment" title="Checking your payment…" spinner>
          This page updates by itself.
        </Heading>
      ) : outcome === "failed" ? (
        <>
          <Heading eyebrow="Payment not completed" eyebrowClass="text-crimson" title="Your payment didn't go through">
            {gateway?.status?.toLowerCase() === "usercancelled"
              ? "The payment window was closed before the payment finished."
              : "Easebuzz couldn't complete the payment."}{" "}
            Nothing is lost — you can try again now.
          </Heading>
          <p className="mt-4 text-ink-muted">If money did leave your account, {contactLine}, and we'll look into it.</p>
          <Actions>
            <Button size="lg" onClick={retry}>
              <RotateCcw aria-hidden />
              Try again
            </Button>
            <LinkButton
              variant="secondary"
              size="lg"
              href={whatsappHref(`Namaste! My donation payment didn't go through. Reference ${pending.orderId}.`)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle aria-hidden />
              Ask for help
            </LinkButton>
          </Actions>
        </>
      ) : outcome === "unknown" ? (
        <>
          <Heading eyebrow="Payment not received yet" eyebrowClass="text-crimson-deep" title="We haven't received your payment yet">
            If you finished paying, it can take a few minutes to reach us.
          </Heading>
          <Alert tone="warning" className="mt-6" title="Please don't pay again straight away.">
            Check again in a minute. If it still isn't here, {contactLine}.
          </Alert>
          <Actions>
            <Button
              size="lg"
              onClick={() => {
                setPolling(true);
                setRound((r) => r + 1);
              }}
            >
              <RotateCcw aria-hidden />
              Check again
            </Button>
            <Button variant="secondary" size="lg" onClick={retry}>
              Start a new payment
            </Button>
          </Actions>
        </>
      ) : (
        <>
          <Heading
            eyebrow={outcome === "confirmed" ? "Payment confirmed" : "Payment received"}
            eyebrowClass="text-success"
            title={`Thank you, ${name}!`}
            spinner={outcome === "confirming"}
          >
            {outcome === "confirming" ? (
              "Easebuzz has accepted your payment. We're recording it now — this usually takes a few seconds."
            ) : (
              <>
                Your donation of <Rupees amount={ack.amount} className="font-semibold text-ink" /> to {trust.name} has
                been received. Here's your acknowledgement.
              </>
            )}
          </Heading>

          {outcome === "received" ? (
            <Alert tone="warning" className="mt-6" title="Our records are still catching up.">
              Easebuzz told us your payment went through, but it hasn't reached our records yet. Keep this
              acknowledgement. If you don't hear from the trust, {contactLine}.
            </Alert>
          ) : null}

          <AcknowledgementCard ack={ack} outcome={outcome} />

          <div data-no-print>
            {pdfState === "failed" ? (
              <Alert tone="error" role="alert" className="mt-6">
                We couldn't create the PDF on this device. You can print this page, or save it as a PDF from the print
                window.
              </Alert>
            ) : null}
            <Actions>
              <Button size="lg" onClick={download} loading={pdfState === "busy"}>
                {pdfState === "busy" ? null : <Download aria-hidden />}
                Download PDF
              </Button>
              {pdfState === "failed" ? (
                <Button variant="secondary" size="lg" onClick={() => window.print()}>
                  <Printer aria-hidden />
                  Print
                </Button>
              ) : null}
              <Button variant="secondary" size="lg" onClick={donateAgain}>
                Make another donation
              </Button>
            </Actions>
            <a
              href={mainSite.home}
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 font-medium text-ink underline-offset-4 hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to the website
            </a>
          </div>
        </>
      )}
    </Page>
  );
}

function AcknowledgementCard({ ack, outcome }: { ack: Acknowledgement; outcome: Outcome }) {
  const rows: [string, string | undefined][] = [
    ["Donor name", ack.donorName],
    ["Donor ID", ack.donorId],
    ["Date", ack.date],
    ["Payment mode", ack.mode],
    ["Easebuzz transaction ID", ack.easebuzzId],
    ["Trust transaction no.", ack.trustTxnId],
    ["Payment reference", ack.reference],
  ];
  return (
    <article
      aria-labelledby="ack-title"
      className="on-ink mt-8 overflow-hidden rounded-[1.75rem] shadow-[0_24px_48px_-28px_rgb(23_25_59/0.7)] [print-color-adjust:exact]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 pb-7 sm:px-8">
        <div>
          <h2 id="ack-title" className="eyebrow text-marigold">
            Donation acknowledgement
          </h2>
          <p className="mt-2 font-display text-[2.75rem] leading-none font-semibold text-white">
            <Rupees amount={ack.amount} />
          </p>
          <p className="mt-3">
            For <span className="font-semibold text-white">{ack.cause || "General donation"}</span>
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            outcome === "confirmed" ? "bg-success text-white" : "bg-white/10 text-white",
          )}
        >
          {outcome === "confirming" ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : null}
          {outcome === "confirmed" ? "Confirmed" : outcome === "confirming" ? "Confirming" : "Received by Easebuzz"}
        </span>
      </div>

      <div className="perforation" aria-hidden />

      <dl className="grid gap-x-8 gap-y-4 px-6 pt-6 pb-2 sm:grid-cols-2 sm:px-8">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="min-w-0">
              <dt className="text-sm">{label}</dt>
              <dd className="mt-0.5 font-medium break-words text-white tabular">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="px-6 pt-4 pb-7 text-sm sm:px-8">
        This acknowledges your online payment. The trust issues your official donation receipt, with its 80G details,
        separately.
      </p>
    </article>
  );
}

function NoReceipt() {
  return (
    <Page title="Receipt">
      <Heading eyebrow="Donation acknowledgement" title="We can't show this receipt here">
        For your privacy, an acknowledgement opens only in the browser tab you paid from. If you need a copy, contact
        the trust with your Donor ID or payment reference and we'll send it.
      </Heading>
      <Actions>
        <LinkButton size="lg" href="/">
          Make a donation
        </LinkButton>
        <LinkButton
          variant="secondary"
          size="lg"
          href={whatsappHref("Namaste! I need a copy of my donation acknowledgement.")}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle aria-hidden />
          Contact the trust
        </LinkButton>
      </Actions>
    </Page>
  );
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <title>{`${title} · Sarvamangal Education Trust`}</title>
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:pb-24">{children}</div>
    </>
  );
}

function Heading({
  eyebrow,
  eyebrowClass = "text-crimson",
  title,
  spinner,
  children,
}: {
  eyebrow: string;
  eyebrowClass?: string;
  title: string;
  spinner?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="step-enter" aria-live="polite">
      <p className={cn("eyebrow", eyebrowClass)}>{eyebrow}</p>
      <h1 className="mt-3 flex items-center gap-3 text-[2.1rem] font-semibold sm:text-[2.75rem]">
        {title}
        {spinner ? <LoaderCircle className="size-7 shrink-0 text-ink-muted motion-safe:animate-spin" aria-hidden /> : null}
      </h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">{children}</p>
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-wrap gap-3">{children}</div>;
}
