# Savor Premium — Stripe Sandbox setup

This integration deliberately accepts **test-mode keys and events only**. The existing product and Price ID are used; the server verifies USD 799 cents every month, quantity one. Hosted Stripe Checkout needs no publishable key or browser Stripe secret.

## What is already ready locally

- The existing Vercel Development Stripe secret key and Price ID were merged into ignored `.env.local`, preserving all other variables.
- A **local Stripe CLI** webhook signing secret was added privately. It is different from the public endpoint secret.
- Migration `002_billing.sql` was applied to the existing Neon database. No auth table, existing user, recipe, or demo identity was changed.
- A Savor-specific test customer portal configuration supports invoice history, payment-method updates, and cancellation at the end of the paid period. No other portal configuration was altered.
- A real Sandbox verification used a newly generated test identity and Stripe's test-card fixture. Its test subscription was canceled after verifying signed webhook activation and cancellation. The separate test identity, canceled subscription, and test history remain for inspection. No real charges or existing subscription changes occurred.

## Try checkout on your computer

Keep two terminals open in this project:

1. Run `pnpm dev` in the first terminal.
2. Run `pnpm stripe:listen` in the second. It uses the existing test API key privately and forwards signed Sandbox notifications to `http://localhost:3000/api/stripe/webhook`. It suppresses the signing secret in terminal output. Restart the app if environment changes are not reloaded automatically.
3. Log in with a **regular account**, open `http://localhost:3000/billing`, and select **Subscribe to Premium**. The demo account intentionally skips checkout and keeps its separate Premium grant.
4. Use only Stripe's [Sandbox test payment details](https://docs.stripe.com/testing). Complete Checkout, then return to Savor. The success page polls only verified membership records; a URL or session ID cannot activate Premium.
5. Open **Manage subscription** to update payment details or cancel. End-of-period cancellation retains Premium through the paid period. An immediate cancellation or expired paid period removes subscription access. Failed payments (`past_due`, `unpaid`, or an unpaid latest invoice) suspend subscription Premium until Stripe confirms payment and an active subscription again. No trial entitlement is provisioned by this version.

The CLI listener must remain running to synchronize local test payments. It does not register a public webhook. `pnpm stripe:portal-setup` can configure the Savor test portal again if necessary. If the listener detects a different local signing secret, it stops without overwriting it; update only that entry in `.env.local` privately. Never paste keys or signing secrets into chat, GitHub, screenshots, or browser code.

## Public webhook registration — your action after approving the code

Exact endpoint:

**https://savor-cookbook-delta.vercel.app/api/stripe/webhook**

In the **same Stripe Sandbox** as the existing product, open **Workbench → Webhooks → Create an event destination** (older dashboards call this **Developers → Webhooks → Add endpoint**).

- Choose **Your account**, **Snapshot** event payloads, and API version **2026-10-28.endive** when offered. This endpoint expects snapshot events, not Thin events.
- Add the exact endpoint URL above.
- Select these events:

```text
checkout.session.completed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
invoice.paid
invoice.payment_failed
invoice.payment_action_required
```

Copy that destination's signing secret **directly into Vercel → savor-cookbook → Settings → Environment Variables**, named **STRIPE_WEBHOOK_SECRET**, marked sensitive, for **Production**. Do not copy the local CLI secret to Production. Keep the existing `STRIPE_SECRET_KEY` as the Sandbox/test key and `STRIPE_PRICE_ID` unchanged.

You can register the destination and configure its secret before the approved deployment. Deliveries will fail until this new code is deployed; do not treat the old production site as ready for subscriptions. If the secret is added after deployment, a new deployment is needed to load it. Checkout intentionally returns a setup error while its signing secret is absent. After the approved release, verify delivery responses are 2xx and perform the same Sandbox checkout/portal/cancellation checks on the public URL.

Preview environments need their own endpoint/listener and signing secret if billing is tested against a separate Preview database or URL. Do not assume the Production destination updates a different Preview database. No Preview signing secret was automatically added. Local callbacks use localhost; Production uses the existing public domain; Preview uses Vercel's supplied deployment hostname. An optional private `SAVOR_APP_URL` can override the callback origin for other environments. Browser-supplied return URLs, price IDs, customer IDs, and user IDs are never trusted.

## Security and synchronization

- Billing endpoints validate a fresh Neon session. Checkout and portal POSTs require the same origin. The server binds Stripe customers, Checkout `client_reference_id`, and subscription metadata to the authenticated immutable Neon user ID.
- The server validates the configured Price and rejects live keys, live Prices, and live webhook events.
- The webhook verifies Stripe signatures against **raw request bytes**, with Stripe's timestamp tolerance. Missing/invalid signatures are rejected. Missing configuration or unsuccessful processing returns 5xx for retry, never a false success.
- Subscription state is always retrieved from Stripe, including the latest invoice. The event's embedded status, checkout redirect, editable email address, and client profile fields cannot grant Premium.
- Per-customer, expiring database leases serialize checkout and webhook writes. Fenced writes prevent an expired worker from overwriting newer state. Event IDs and subscription snapshots are persisted atomically. Retries are idempotent; out-of-order notifications re-fetch current Stripe state. Monitor failures and Stripe retries; do not manually grant access to compensate for an unsuccessful delivery.
- Only active, unpaused subscriptions for the configured Price with a paid latest invoice and unexpired period receive Premium. Scheduled cancellations retain access until that period ends. Stripe records never overwrite the immutable demo grant.
- Duplicate checkout prevention checks Stripe for non-terminal subscriptions, reuses pending sessions, persists attempt IDs, and uses Stripe idempotency keys. Existing subscribers go to the portal. Inconsistent customer mappings fail closed for review. Stripe administrators or external integrations can still create duplicates outside this application; investigate those in the Sandbox dashboard rather than creating more plans.
- The new `savor.billing_customers`, `savor.subscriptions`, and `savor.stripe_events` tables are server-only application data with PUBLIC privileges revoked. Existing ownership checks and AI cost caps remain in effect. Premium is not administrator access or a bypass of AI spending limits.
- No Checkout success page changes database entitlements. The customer portal configuration does not permit switching to other products/prices.

## Checks

- `pnpm test:billing` covers Price validation, subscription state rules, signature tampering/expiration, deduplication, canonical state retrieval, payment failures/recovery, cancellation, stale events, customer identity mismatch, lease fencing, and demo separation.
- `pnpm test:access`, `pnpm test:recipes`, `pnpm typecheck`, and `pnpm build` are existing regression checks.
- `RUN_STRIPE_SANDBOX_CHECK=yes node scripts/check-billing.mjs` is **opt-in**: it creates a separate Neon test identity, a test Stripe customer/Checkout/subscription, uses Stripe's `tok_visa` fixture, verifies real forwarded signed events, tests replay and portal access, and cancels only that newly created subscription. It never deletes Neon users and retains test history. Run only with explicit approval and a working local listener. It is not a production health check.

Do not switch to live payments without a separate review, explicit authorization, live-mode configuration, and live webhook registration. No code was pushed or deployed as part of this setup.
