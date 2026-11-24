# Sarvamangal donation app

The donation page for Sarvamangal Education Trust — **donation.sarvamangaleducationtrust.org**.
React 19 + TypeScript + Vite + Tailwind v4. It replaces the donor-facing pages of the old
`sarvam_donation_management_frontend` (DashLite) app, and uses the same API and database.

```
Sarvamangal (main site, Next.js)  ──Donate links ?amount=&cause=──▶  this app (React)
                                                                       │
                                                                       ▼
                                          sarvam_donation_management (Node API, Postgres)
                                                                       │
                                                                       ▼
                                                              Easebuzz checkout
```

## Run it

```bash
npm install
cp .env.example .env      # then edit — see below
npm run dev               # http://localhost:5173, against the API in .env
npm run dev:mock          # demo mode: in-memory fake API + simulated payment, no backend needed
npm run build             # type-check + production build → dist/
npm run lint
```

**Demo mode** (`npm run dev:mock`, `mock/mock-api.ts`) follows the real API's rules — new donors get a Donor
ID a few seconds after registering, PAN is asked for at ₹1,000 or more a year — and the payment is a yes/no dialog.
Try `9876543210` (₹600 given this year, no PAN) and `9811111111` (PAN on file). Data resets when the server
restarts. None of it is in a production build.

| Variable | What it is |
| --- | --- |
| `VITE_API_BASE_URL` | The sarvam_donation_management API. Test: `https://api-test-donation.sarvamangaleducationtrust.org`. Local: `http://localhost:9997`. |
| `VITE_EASEBUZZ_ENV` | `test` or `prod`. **Must match the API's `payment_config.yaml`** (`testpay.easebuzz.in` = test, `pay.easebuzz.in` = prod). |
| `VITE_MAIN_SITE_URL` | The main website. Logo, "Back to website" and the policy links go here. |

All three are baked into the build (they're public). Set them in the host's build settings for production.

## What a donor does

One page, one form (`src/features/donate/DonateForm.tsx`):

1. **Cause** — Health, Education, Society, Spirituality, or "Wherever it's needed most". **Amount** — chips (₹500 / ₹1,500 / ₹5,000, the main site's tiers) or any whole-rupee amount.
   Both are pre-filled from the main site's link (`?amount=1500&cause=health`) and stay editable.
2. **First name, middle name, surname, mobile number** — all required. The mobile number identifies the donor: as
   soon as it's typed, the app asks the API whether it already has a Donor ID — and, for the amount chosen, whether
   this gift needs a PAN. It asks again whenever the amount or the number changes.
3. **PAN — shown only when it's needed**, and then required, with the message "with this gift, your donations in this
   financial year come to ₹1,000 or more…". The API decides, by mobile number (`pan_required`): the donor has no
   PAN on file and their successful online donations in the current financial year (1 April – 31 March), **including
   this gift, come to ₹1,000 or more** — exactly ₹1,000 needs one. So a new donor sees it for a gift of ₹1,000 or
   more; a returning donor sees it once this gift takes their year's total to ₹1,000 (₹600 given + ₹400 now, not
   ₹399); a donor with a PAN on file never does.
   The field waits for a mobile number, and the form never guesses — a donor with a PAN on file is never asked. If
   the check fails (API unreachable, or without the new endpoint), the form says so under the mobile number and
   shows no PAN field. The form never learns the total itself. Creating the donation enforces the same rule
   (`PAN_REQUIRED`), which brings the field up if the check couldn't answer.
4. **Declaration** checkbox — information true to the best of my knowledge, and Indian citizen living in India
   (the trust accepts no NRI or foreign donations).
5. **Pay** → new donors are registered and wait a few seconds for their Donor ID → the donation is created → the
   Easebuzz window opens.
6. **Acknowledgement** (`/receipt/:id`) — the app checks the API until Easebuzz's webhook has recorded the payment
   ("Confirming" → "Confirmed"), shows the acknowledgement, and offers **Download PDF** (`src/lib/acknowledgement-pdf.ts`,
   drawn with jsPDF, loaded only on click). Failed or cancelled payments get "Try again", which refills the form.
   A payment Easebuzz reports as **pending** (a UPI request still waiting for the bank) is not a failure: the page
   keeps checking and asks the donor not to pay again, and the API keeps the donation pending until Easebuzz reports
   the final result.

The acknowledgement only opens in the browser tab that paid (sessionStorage) — the API's `get_donation_online/:id`
is public and ids are sequential, so a guessed link won't show someone else's name.

Normally the Easebuzz window reports back to the page. If Easebuzz instead sends the donor to its return address
(`surl`/`furl` = the API's `APP_BASE_DOMAIN` + `/app/paymentdetails/receipt/:id/:order`), it does so with a
form **POST**. `api/easebuzz-return.js` (Vercel, via `vercel.json`) and `easebuzzReturn` in `vite.config.ts` (dev)
answer it with a 303 to `/receipt/:id`; on Apache, `.htaccess` serves the app for POSTs as well.

## The API

| Call | Endpoint | Notes |
| --- | --- | --- |
| Is this mobile registered? Does this gift need a PAN? | `GET /donor/api/v1/get_donor_status_by_mobile/?mobile=&amount=` | **New.** Returns `registered`, `registration_pending`, `pan_required` (for `amount`; `null` without one), `financial_year`, `pan_required_from` — nothing personal (no name, PAN, Donor ID or yearly total). `pan_required` is the same yes/no that creating the donation gives. |
| Register a donor | `POST /donor/api/v1/register_donor_by_mobile/` | **New.** `{first_name, middle_name, last_name, mobile, pan_no?}` (all three names required) → `{status: "registered" \| "pending"}`. Writes `donors_registration`; never registers a mobile (or PAN) twice. A PAN here only finds an existing donor — it isn't stored. |
| Create the donation | `POST /donation_online/api/v1/create_donation_by_mobile/` | **New.** `{mobile, amount, purpose_of_donation, pan_no?}` → the `donation_online` row. Enforces the PAN rule (`errorCode: PAN_REQUIRED`); a PAN given is kept on the donation (`pan_no`), refused if it's another donor's. |
| Start Easebuzz | `POST /payment_integration/api/v1/easebuzz_checkout` | Existing, **changed**: charges the donation's saved amount — refuses a different one (`AMOUNT_MISMATCH`), an unknown donation (`DONATION_NOT_FOUND`) or one already paid (`ALREADY_PAID`). When Easebuzz is down, slow (15 s) or refuses, answers `EASEBUZZ_UNREACHABLE` / `EASEBUZZ_TIMEOUT` / `EASEBUZZ_ERROR` (HTTP 502) — before, an unreachable Easebuzz crashed the whole API process. |
| Payment status | `GET /donation_online/api/v1/get_donation_online/:id/` | Existing. Updated by Easebuzz's webhook + the API's scheduler. |

The three new endpoints live in `sarvam_donation_management/src/donor/` and `src/donation_online/`; the shared rules
(PAN at ₹1,000 or more, financial year, mobile matching, PAN hand-over) are in `src/donor/donor_by_mobile_helpers.js`.
Two deliberate exceptions to "don't touch the existing API" (Nov 2026):

- **One column:** `donation_online.pan_no` (`db_scripts/2026-11-23_donation_online_pan_no.sql`). A PAN typed with a
  donation waits there and is copied to `donors.pan_no` only once that payment succeeds — otherwise anyone who knows a
  donor's mobile number could attach a PAN to their record without paying.
- **Checkout charges the saved amount**, so a ₹500 donation can't be paid as ₹50,000 to get round the PAN rule.
  The old app sends the same amount it saved, so it's unaffected.

How the data lands:

- A new donor goes into `donors_registration` (no address, no PAN). The API's scheduler
  (`maintenance_job_scheduler.js`, every 3 s) creates the `donors` row and the Donor ID, as it already does.
- Easebuzz's webhook (`easebuzz_webhook.js`) writes `easebuzz_payments` and marks the donation `success` / `failed`;
  the scheduler (every 5 s) copies any result the webhook missed. On success both hand the donation's PAN to the
  donor if they have none (`applyDonationPan`). **Without the webhook nothing is ever confirmed** — the scheduler
  only reads what the webhook saved.
- Easebuzz may report an order more than once as it settles (`pending`, then `success` or `failure`). `pending` /
  `initiated` leave the donation pending (`helpers.isEasebuzzPending`, in the webhook and the scheduler); a later
  status replaces the stored one, and a recorded `success` is never overwritten. (Before Nov 2026 the first report
  won, so a UPI payment reported `pending` was marked failed and its later `success` was dropped as a duplicate.)
- The cause is saved in `donation_online.purpose_of_donation` as `Health`, `Education`, `Society`, `Spirituality` or
  `General Donation` (the value already used for open gifts).
- The financial-year total counts `donation_online` rows with `payment_status = 'success'` for that Donor ID.

## Connected to the main site

- The main site's Donate buttons use `donateHref()` (`Sarvamangal/src/lib/utils.ts`), which adds `?amount=&cause=<slug>`.
  The homepage banner (`HeroGive`) and the Give section both send the chosen tier's amount and cause.
- Cause slugs here (`src/lib/reference.ts` → `CAUSES`) must match the main site's cause slugs.
- The Donate URL is a CMS setting on the main site (Site settings → Donate URL). For local testing set it to
  `http://localhost:5173/`.
- Colours, type (Fraunces + Inter), buttons and form conventions copy the main site's design system
  (`Sarvamangal/design-system/sarvamangal/MASTER.md`). The trust's contact and registration facts are in
  `src/config.ts` — keep them in step with the main site's Site settings.

## Deploy the API changes first

The form needs the three new endpoints. Until the API server has them, every payment stops at
"Something went wrong while trying to create your Donor ID". In this order:

1. **Run** `db_scripts/2026-11-23_donation_online_pan_no.sql` on the database (adds `donation_online.pan_no`;
   safe to run twice). The new code writes that column, so do this first.
2. **Copy** these from `sarvam_donation_management` to the server:

   ```
   router/donor.js                                   (changed — 2 routes added)
   router/donation_online.js                         (changed — 1 route added)
   src/donor/donor_by_mobile_helpers.js              (new)
   src/donor/get_donor_status_by_mobile.js           (new)
   src/donor/register_donor_by_mobile.js             (new)
   src/donation_online/create_donation_by_mobile.js  (new)
   src/payment_integration/easebuzz_checkout.js      (changed — charges the saved amount; survives Easebuzz being down)
   src/payment_integration/easebuzz_webhook.js       (changed — failed and pending payments; PAN hand-over)
   maintenance_job_scheduler.js                      (changed — PAN hand-over; pending payments)
   ```

3. **Check** `APP_BASE_DOMAIN` in the server's `appconfig/<env>/env_config.yaml` is this app's address
   (`https://donation.sarvamangaleducationtrust.org`) — it's Easebuzz's return address (`surl`/`furl`). It is already,
   on both the live and the test server — so test payments in redirect mode would return to the live site. With
   `EASEBUZZ_IFRAME: 1` (both servers, Nov 2026) the window answers the page instead and the address isn't used.
   **CORS:** the live server's `app.js` (edited on the server, not in git) only accepts requests from the
   `*.sarvamangaleducationtrust.org` addresses it lists. Serve this app from `donation.sarvamangaleducationtrust.org`,
   or add its address there — otherwise every POST from the form is blocked by the browser.
4. **Restart** the API (`app.js`) and the scheduler (`maintenance_job_scheduler.js`, same database — it issues
   Donor IDs and records payments).
5. **Easebuzz dashboard** → webhook URL = `<api>/payment_integration/api/v1/easebuzz_webhook/`, for the same
   environment (test or prod) as the keys in `payment_config.yaml`.

Check: `GET <api>/donor/api/v1/get_donor_status_by_mobile/?mobile=9876543210` should answer with JSON, not
"Cannot GET" — the test API still answered "Cannot GET" on 23 Nov 2026.

**Running the API locally** instead: fill in `server_config/postgres_config.yaml` (host, user, password, database,
defaultSchema) and `payment_config.yaml` (Easebuzz test key and salt) with the test server's values, start
`node app.js` (and `node maintenance_job_scheduler.js` if no server runs it on that database), and set
`VITE_API_BASE_URL=http://localhost:9997` (the port in the repo's `app.js`; the live server's edited copy uses 5521). With empty credentials every query fails with
"SASL: … client password must be a string".

**When a payment step fails** in `npm run dev`, the message ends with a `[dev: …]` note naming the cause — a missing
endpoint (404), or an API that can't reach its database. Donors on the live site see only the plain message.

## Deploy

It's a static single-page app: deploy `dist/`. Every path must fall back to `index.html`:
`public/.htaccess` does that on Apache, `vercel.json` on Vercel (plus `api/easebuzz-return.js`, the one function, for
Easebuzz's POST back — see "What a donor does").

**The old app also serves the admin panel** (`/admin`, donors, receipts, vouchers) from the same domain. Before pointing
`donation.sarvamangaleducationtrust.org` at this app, move the old app to another address (e.g. an `admin.` subdomain)
so the trust keeps its admin pages.

## Layout

```
api/easebuzz-return.js      Vercel only: Easebuzz's POST back → 303 to /receipt/:id
src/
  config.ts                 env + the trust's facts
  lib/api.ts                every API call, with the response envelope and error codes
  lib/easebuzz.ts           loads Easebuzz's checkout script on demand
  lib/pending.ts            the payment this tab started (sessionStorage)
  lib/reference.ts          causes, suggested amounts, PAN threshold fallback
  lib/acknowledgement-pdf.ts
  features/donate/          DonatePage (link pre-fill), DonateForm, GiftSummary, useDonorStatus
  features/receipt/         ReceiptPage (status polling, acknowledgement, retry)
  components/               layout (header, footer) and ui (Button, Field, Alert, Rupees)
```
