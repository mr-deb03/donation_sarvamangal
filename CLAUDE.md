@README.md

# Working on this repo

- Sibling repos: `../Sarvamangal` (main site — its design system and CLAUDE.md rules apply here too),
  `../sarvam_donation_management` (API + DB; the three `*_by_mobile` endpoints were added for this app),
  `../sarvam_donation_management_frontend` (old app — reference only). `../sarvam-web` is unrelated.
- Same database as the old app: don't change the schema. Add API endpoints rather than changing existing ones —
  the old app and its admin pages still use them. Exceptions so far (Nov 2026, see README → The API):
  `donation_online.pan_no` (SQL in `db_scripts/`), checkout charging the saved amount, and the webhook's
  failed-payment update (it wrote a column that doesn't exist).
- The PAN rule lives in the API (`donor_by_mobile_helpers.js`); the form only mirrors it. It applies at **₹1,000 or
  more** in a financial year, this gift included — exactly ₹1,000 needs a PAN (owner's call, 24 Nov 2026: `>=`.
  It went `>=` → `>` → `>=` over 23–24 Nov; if it changes again, flip `panRequired` and rename
  `PAN_REQUIRED_FROM` / `pan_required_from` to match).
  A PAN reaches `donors` only after a successful payment (`applyDonationPan`), never from registration or creation.
  The PAN field is shown only when the API says this gift needs one (`pan_required`, by mobile number) — no optional
  PAN field. First, middle and surname are all required, in the form and in `register_donor_by_mobile` (owner's call,
  23 Nov 2026).
- Copy: plain, sentence case, Indian English. Never invent numbers or claims about the trust.
  Donations are for Indian citizens living in India only — say so wherever someone is about to pay.
- Tokens only (`bg-ink`, `text-crimson`…), no raw hex in components. Touch targets ≥ 44px. Respect reduced motion.
- Before calling work done: `npm run build` and `npm run lint`.
