/**
 * Easebuzz's return address (surl / furl), set by the API's easebuzz_checkout:
 *   APP_PORTAL_BASE_DOMAIN/app/paymentdetails/receipt/:donationId/:orderId
 *
 * When Easebuzz sends the donor back to it, it does so with a form POST. On Vercel a page of
 * a static site only answers GET, so a POST there gets "405 Method Not Allowed" — right after
 * the donor has paid. vercel.json sends that path here instead, and this answers with a
 * 303 to the receipt page, which the browser then loads with a plain GET.
 *
 * Nothing in the POST is read or trusted: the receipt page asks the API for the payment's
 * status (written by Easebuzz's webhook), and only shows donations started in that tab.
 * `npm run dev` / `preview` do the same (vite.config.ts → easebuzzReturn).
 */
function toReceipt(request) {
  const url = new URL(request.url);
  const id =
    url.searchParams.get("donationId") ?? url.pathname.match(/\/paymentdetails\/receipt\/(\d+)\//)?.[1] ?? "";
  return new Response(null, {
    status: 303,
    headers: { Location: /^\d{1,12}$/.test(id) ? `/receipt/${id}` : "/", "Cache-Control": "no-store" },
  });
}

export const GET = toReceipt;
export const POST = toReceipt;
