# Razorpay Billing — Setup & Operations Guide

WhatsLark's subscription billing (starter / professional / business, monthly
or yearly, billed in INR) is handled by Razorpay Subscriptions. This doc
covers everything needed to configure, test, and operate it.

**Merchant of record**: ByteLark Private Limited.
**Currency**: INR. Meta/WhatsApp messaging charges are separate — not part of
this subscription.

---

## 1. Razorpay account requirements

- A Razorpay **Business** account for ByteLark Private Limited, KYC-verified
  (required before you can go live — Test Mode works without it).
- Razorpay **Subscriptions** product enabled on the account (Dashboard →
  Subscriptions — some accounts need this turned on by Razorpay support).
- Dashboard access with permission to create Plans, view API Keys, and
  configure Webhooks.

## 2. Test Mode setup

1. Log into the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Toggle **Test Mode** (top-left switch) — stays on until you explicitly
   switch to Live.
3. Go to **Settings → API Keys → Generate Test Key**. Copy the Key ID
   (`rzp_test_...`) and Key Secret — you'll only see the secret once.
4. These become `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in your `.env`.

Never put Test or Live keys in git. `.env.example` only has placeholders.

## 3. Creating monthly and yearly Razorpay Plans

For **each** of the 6 combinations (starter/professional/business ×
monthly/yearly):

1. Dashboard → **Subscriptions → Plans → + New Plan**.
2. Set **Billing frequency** (Every 1 Month / Every 1 Year), **Amount** (in
   ₹, Razorpay stores it internally as paise), plan name/description.
3. Save — Razorpay gives you a Plan ID like `plan_Nb1234567890ab`.

Do this 6 times (Test Mode first). Repeat again in Live Mode when going
live — **Test and Live plan IDs are different and not interchangeable.**

## 4. Mapping Razorpay Plan IDs to local billing prices

Migration `supabase/migrations/029_billing.sql` seeds `billing_plans` +
`billing_prices` with **placeholder** `provider_plan_id` values
(`plan_PLACEHOLDER_STARTER_MONTHLY`, etc.) and placeholder `amount_minor`.

After creating the real Plans in Razorpay (step 3), update each row:

```sql
UPDATE billing_prices
SET provider_plan_id = 'plan_REAL_ID_FROM_RAZORPAY',
    amount_minor = 99900  -- ₹999.00, in paise — integer, never a float
WHERE provider_plan_id = 'plan_PLACEHOLDER_STARTER_MONTHLY';
```

Repeat for all 6 rows. `amount_minor` here is the **source of truth** shown
to customers — it does not need to exactly equal the Razorpay Plan's amount
in principle, but in practice keep them identical or customers will see one
price on `/pricing` and get charged another.

The frontend never sends a Razorpay Plan ID or a price — only a
`billing_price_id` (our internal UUID). The backend loads the trusted price
and provider plan id server-side (`billing.repository.ts#getActivePriceById`).

## 5. Environment variables

| Variable | Where | Notes |
|---|---|---|
| `RAZORPAY_ENABLED` | Render (API) | `true`/`false`. If `true`, the other 3 below are required or the API refuses to boot. |
| `RAZORPAY_KEY_ID` | Render (API) | Test or Live key id. |
| `RAZORPAY_KEY_SECRET` | Render (API) | **Secret.** Never in frontend, never in git. |
| `RAZORPAY_WEBHOOK_SECRET` | Render (API) | Set when creating the webhook (§7/§8). **Secret.** |
| `BILLING_CURRENCY` | Render (API) | `INR`. Informational — actual currency is per-price in the DB. |
| `BILLING_GRACE_PERIOD_DAYS` | Render (API) | Days a company keeps paid access after a failed charge (`subscription.pending`). Default `3`. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Vercel (web) | Same value as `RAZORPAY_KEY_ID`. Public by design — Razorpay Checkout needs it client-side. Currently the app instead receives the key id from the `POST /billing/subscriptions` response, so this var is optional/for future direct use, but keep it in sync if you rely on it elsewhere. |

## 6. Supabase migrations

Run `supabase/migrations/029_billing.sql` (via Supabase SQL Editor, same as
every other migration in this repo — there's no separate migration runner).
It creates: `billing_plans`, `billing_prices`, `billing_subscriptions`,
`billing_payments`, `billing_webhook_events`, `company_usage_counters`, RLS
policies, and seeds the placeholder plans/prices from §4.

## 7. Test webhook URL

Local development, using ngrok (already used for WhatsApp webhooks in this
repo — see root `.env.example`):

```
https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app/api/v1/billing/webhooks/razorpay
```

Dashboard (Test Mode) → **Settings → Webhooks → + Add New Webhook**:
- URL: the above
- Secret: generate any random string, put it in `RAZORPAY_WEBHOOK_SECRET`
- Select events: see §9

## 8. Production webhook URL

```
https://YOUR-RENDER-API-DOMAIN/api/v1/billing/webhooks/razorpay
```

(Note the `/api/v1` prefix — the whole API is mounted under it, see
`apps/api/src/main.ts`.) Configure this in **Live Mode** on the Razorpay
Dashboard once you're ready to go live, with a **separate** webhook secret
from the Test Mode one.

## 9. Webhook events to select

Enable at minimum:

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.updated`
- `subscription.pending`
- `subscription.halted`
- `subscription.paused`
- `subscription.resumed`
- `subscription.cancelled`
- `subscription.completed`

All are handled in `apps/api/src/billing/webhooks/razorpay-webhook.service.ts`.

## 10. How to test subscription activation

1. `RAZORPAY_ENABLED=true` locally with Test keys, ngrok tunnel + webhook
   configured (§7).
2. Log in as a company owner, go to `/pricing`, pick a plan.
3. Razorpay Checkout opens — use a [Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
   (e.g. `4111 1111 1111 1111`, any future expiry, any CVV).
4. On success, the frontend calls `POST /billing/subscriptions/verify`
   (signature check) then shows "Payment verification in progress."
5. Razorpay sends `subscription.authenticated` then `subscription.activated`
   to your webhook — `/settings/billing` polls briefly and flips to Active.

If it doesn't activate within ~30s, check Render logs for the webhook
controller, and Razorpay Dashboard → Webhooks → your webhook → recent
deliveries (shows response codes and payload).

## 11. How to test renewals and failed payments

- **Renewal**: Razorpay Test Mode lets you trigger a subscription charge
  manually from the Dashboard (Subscriptions → your test subscription →
  actions), or wait for the natural cycle if you set a short test plan
  interval. Confirms `subscription.charged` → new row in
  `billing_payments`, updated `current_period_end`.
- **Failed payment**: use a [Razorpay test card that simulates failure](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
  during a renewal attempt (Dashboard lets you force this on a test
  subscription). Confirms `subscription.pending` → `grace_ends_at` set,
  `/settings/billing` shows the amber grace-period banner. After repeated
  failures, Razorpay eventually sends `subscription.halted`.

## 12. How to switch from test keys to live keys

1. Complete Razorpay KYC/activation for ByteLark Private Limited.
2. Recreate all 6 Plans in **Live Mode** (§3) — new Plan IDs.
3. Update `billing_prices.provider_plan_id` for all 6 rows to the live IDs
   (§4), and confirm `amount_minor` matches the real production price.
4. Create the Live Mode webhook (§8) with a fresh secret.
5. In Render: set `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` to live values,
   `RAZORPAY_WEBHOOK_SECRET` to the live webhook's secret, `RAZORPAY_ENABLED=true`.
6. In Vercel: set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to the live key id if used.
7. Do a real ₹1 test purchase yourself before announcing.

## 13. Vercel frontend variables

- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (optional, see §5)
- `NEXT_PUBLIC_API_URL` (already exists — must point at the Render API)

No Razorpay secret ever belongs in Vercel env vars.

## 14. Render backend variables

Add via Render Dashboard → your service → Environment (or `apps/api/render.yaml`,
which already declares the keys with `sync: false` so their values must be
set manually per-environment, never committed):

`RAZORPAY_ENABLED`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `BILLING_CURRENCY`, `BILLING_GRACE_PERIOD_DAYS`.

## 15. Reconciliation procedure

If a webhook is ever missed (Razorpay outage, deploy downtime, etc.), a
subscription's local status can drift from Razorpay's canonical state.
`BillingService.reconcileSubscription(localSubscriptionId)`
(`apps/api/src/billing/billing.service.ts`) fetches the subscription
directly from Razorpay and overwrites local status/period dates with the
canonical values. It is not yet wired to a controller route — call it from
a super-admin script/REPL, or add a `@Roles` super-admin-guarded endpoint
if you need it exposed in the admin UI. Do not expose it to regular company
users.

## 16. Common signature/raw-body errors

- **"Invalid Parameters" / signature never matches**: something parsed or
  re-serialized the body before it reached the webhook controller. This app
  already has `rawBody: true` set app-wide in `apps/api/src/main.ts` — if you
  add any global body-parsing middleware in front of Nest, make sure it
  preserves `req.rawBody` untouched.
- **Checkout verify fails with "Subscription id mismatch"**: the browser
  sent a `razorpay_subscription_id` that doesn't match what's stored against
  `local_subscription_id` — this is expected behavior if someone tampers
  with the request; it is not a bug.
- **Webhook 401 "invalid signature"**: `RAZORPAY_WEBHOOK_SECRET` on the
  server doesn't match what's configured on that specific webhook in the
  Razorpay Dashboard. Test Mode and Live Mode webhooks each have their own
  secret — mixing them up is the most common cause.
- **`app access token rejected` type errors from `/{app-id}/subscriptions`**:
  unrelated to billing — that error format only comes from the WhatsApp/Meta
  webhook diagnostics, not Razorpay. If you see it here, check you didn't
  copy the wrong secret.

## 17. Rollback procedure

Billing is fully additive — no existing table was altered, only new ones
added, and entitlement checks fail open to `FREE_ENTITLEMENTS` (never grant
by accident, but also never crash existing flows if billing data is absent).

To roll back:

1. Set `RAZORPAY_ENABLED=false` in Render and redeploy — `BillingModule`'s
   provider stops requiring credentials, and all subscription
   creation/checkout endpoints return a clear "Billing is not enabled" error
   instead of crashing.
2. Optionally hide the `/pricing` and `/settings/billing*` nav entries (they
   still render — GET endpoints work regardless of `RAZORPAY_ENABLED` — but
   you can gate the UI further if desired).
3. Full schema rollback (only if truly necessary): drop the 6 new tables and
   their enums. **This deletes subscription/payment history — do not do this
   in production without a backup.** No existing table's data is affected
   either way.

---

## Manual steps you must perform (not automatable from this repo)

- Complete Razorpay KYC/business verification for ByteLark Private Limited.
- Create the 6 Plans in Razorpay Dashboard (Test, then Live) and update
  `billing_prices` rows with real Plan IDs and amounts (§4).
- Configure the Test and Live webhooks in Razorpay Dashboard (§7/§8).
- Set all Render/Vercel environment variables (§13/§14).
- Run `supabase/migrations/029_billing.sql` against your Supabase project.
- Decide final production pricing (placeholders are in the migration —
  clearly marked, not real prices).
