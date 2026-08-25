# Entitlements

How a purchase becomes access to FABTrades Pro, and why the server owns the answer.

## The one idea worth holding onto

A purchase is one way to **acquire** access. Access itself is a row in Postgres keyed
by Supabase `user_id`.

Everything else follows from that separation. Buy on iOS, get Pro on Android and the
web. Refunds and lapses take access away by the same path they granted it. And a
support question — "why does this person have Pro?" — has one place to look, rather
than three stores to interrogate.

Both Apple and Google permit this. What they do not permit is collecting money
outside their systems on their platforms, which is a different question.

```mermaid
flowchart TD
  ios["iOS app"] --> rc[RevenueCat]
  android["Android app"] --> rc
  appStore["App Store Server Notifications V2"] --> rc
  play["Play RTDN (Pub/Sub)"] --> rc
  rc -->|"webhook, then REST read-back"| fn["revenuecat-webhook"]
  nightly["reconcile-entitlements (nightly)"] -->|"REST read"| rc
  fn --> ent[("entitlements")]
  nightly --> ent
  ent -->|"RLS: select own row"| clients["web, iOS, Android"]
```

## Tables

| Table | Holds | Written by |
| --- | --- | --- |
| `entitlements` | One row per user: current access | Service role only |
| `billing_events` | Raw provider events, keyed by event id | Service role only |

`entitlements` has exactly one policy: `select` where `auth.uid() = user_id`. There
is no insert, update, or delete policy, so a client can read its own access and
change nobody's. A client that could write `is_active` could grant itself Pro.

`billing_events` has RLS enabled and **no** policies, which leaves it reachable only
by the service role. Nobody's purchase history is any client's business, including
their own — the state a client needs is in `entitlements`.

### Why one row of state, not a ledger

`entitlements` holds *current* state, and the webhook overwrites it wholesale. That
choice is load-bearing:

- Store events arrive **out of order**. A renewal can land before the expiry it
  replaces.
- Events mean less than their names suggest. A refund arrives as a `CANCELLATION`,
  and a billing failure looks like an expiry until it recovers.
- Deliveries repeat. RevenueCat retries until it gets a 200.

Folding a stream like that into a boolean drifts, and the drift is invisible until a
customer complains. So the webhook does not trust the event body for state at all —
it re-reads the whole customer from RevenueCat and overwrites the row. That is
idempotent by construction: applying the same event twice, or two events in the wrong
order, converges on the same answer.

`billing_events` is the ledger, and it exists for two reasons: its primary key gives
idempotency, and a disputed charge is argued from what the provider actually said.
The mapping into `entitlements` is lossy by design, and this is the only place the
discarded detail survives.

## The webhook

`supabase/functions/revenuecat-webhook`, in order:

1. **Check the shared secret** in the `Authorization` header. Otherwise the URL is
   the only thing protecting an endpoint that grants paid access, and URLs leak. The
   comparison is constant-time.
2. **Record the event** in `billing_events`, keyed by RevenueCat's event id. Already
   recorded means a replay: return 200 without doing anything else, so a redelivery
   burst does not become a burst of RevenueCat API calls.
3. **Read current state** from `GET /v1/subscribers/{app_user_id}`.
4. **Overwrite the `entitlements` row** and return 200.

Failures return 5xx, because that is what makes RevenueCat retry — the retry is the
repair path. Anything unprocessable returns 2xx or 4xx to *stop* the retries: an
unparseable body, a missing event id, or an `app_user_id` that is not one of ours will
not succeed on the tenth attempt either. A missing secret returns 503 for the same
reason.

If the entitlement write fails, the handler deletes the event it just recorded before
returning 500. Without that, the retry would recognise its own event as a replay and
acknowledge it — leaving a paying customer on `free` with nothing left to notice,
because a purchase that never landed has no row for reconciliation to find.

### Identity binding is the linchpin

The client calls `Purchases.logIn(supabaseUserId)` immediately after Supabase
sign-in, so webhooks for identified customers name an id the server can write a
row for without a lookup table.

**Do not gate the paywall behind sign-in.** App Review 5.1.1(v) requires that
In-App Purchase work without registration when the product is not account-based.
Pro unlocks local features (unlimited binder, want list, lending, trade history)
that work signed out, so the paywall must open for a guest. Mobile grants Pro
from StoreKit `CustomerInfo` immediately; that path does not need a server row.

An anonymous purchase creates a RevenueCat customer with a `$RCAnonymousID:…`.
Events whose `app_user_id` is not a UUID fall back to `original_app_user_id`,
and if that is not one of ours either, the event is recorded and ignored — there
is no row to write yet. `Purchases.logIn` aliases that anonymous customer onto
the Supabase user when they later sign in (the optional post-purchase prompt,
or My Account). After aliasing, subsequent events name the UUID and the row
appears.

The binding happens in two places, deliberately. `purchasesIdentityProvider`
keeps it current as sessions come and go, and the paywall **best-effort awaits**
it when the customer is already signed in — because the provider does its work
as a side effect of a rebuild, which is not ordered against opening a paywall.
`Purchases.logIn` is idempotent. A bind failure must not block the paywall.

Sign-out matters just as much: leaving the previous user's id in place would
attribute the next account's purchases to them. The provider does nothing at all
while the session is still being restored, since treating "not yet known" as
"signed out" would unbind the real identity on every launch.

### Sandbox

Sandbox purchases are indistinguishable from real ones in every other field, so
`is_sandbox` is recorded — a test purchase in production should be visible rather than
mistaken for revenue.

RevenueCat also excludes sandbox and StoreKit-test transactions from
`GET /subscribers` unless the request sends `X-Is-Sandbox: true`. Without it a sandbox
delivery resolves to "no purchase" and does nothing, which is very hard to read as a
sandbox-only problem. The webhook sets the header when the event says
`environment: SANDBOX`.

## Nightly reconciliation

`supabase/functions/reconcile-entitlements`, called by
`.github/workflows/reconcile-entitlements.yml` at 05:00 UTC.

Webhooks are the fast path and cannot be the only path:

- A delivery can exhaust its retries during an outage.
- An **expiry is a non-event**. Nothing fires when a subscription simply lapses.

Either leaves a customer with the wrong access and nothing to notice. So once a night,
re-read state for everyone whose row is about to matter: active subscribers whose
`expires_at` falls between seven days ago and 36 hours from now. Looking back a week
covers a late-recorded renewal or a retried card; looking ahead covers a renewal that
should be seen as a renewal rather than a lapse. Keeping the set that small is what
makes a full sweep of every user unnecessary.

Rows with no `expires_at` — lifetime unlocks and promotional grants — never appear,
which is correct: nothing about them changes on a clock.

A row is written only when something actually moved, compared across every derived
column rather than just the tier. A renewal moves only `expires_at`, and skipping that
write would leave the row permanently stale: still inside tonight's window, still
skipped, every night after. Leaving untouched rows alone keeps `updated_at` meaning
"when this last changed" rather than "when a job last ran".

One unreachable customer does not abandon the sweep; failures are collected and
reported, and the run exits non-zero so the scheduled job goes red with the successful
work already committed.

## Configuration

Secrets live in Supabase, not in the repo:

```bash
supabase secrets set \
  REVENUECAT_WEBHOOK_SECRET=<any long random string> \
  RECONCILE_SECRET=<a different long random string> \
  REVENUECAT_API_KEY=sk_<secret key from RevenueCat> \
  REVENUECAT_ENTITLEMENT_ID='FABTrades Pro'

supabase functions deploy revenuecat-webhook
supabase functions deploy reconcile-entitlements
```

Both functions have `verify_jwt = false` in `supabase/config.toml`. RevenueCat sends
the shared secret above, not a Supabase JWT, so with gateway verification on every
delivery would 401 — the secret check inside the function is what replaces it. It is
declared in config rather than passed as `--no-verify-jwt` so that a deploy which
forgets the flag cannot silently break billing.

`REVENUECAT_API_KEY` must be a **secret** key (`sk_…`). The publishable key the apps
use returns nothing useful from `/subscribers`.

In the RevenueCat dashboard, under **Integrations → Webhooks**, point the URL at
`https://<project>.supabase.co/functions/v1/revenuecat-webhook` and set the
Authorization header to `Bearer <REVENUECAT_WEBHOOK_SECRET>`.

Staging uses a **separate sandbox-only webhook** aimed at fabloodle
(`cnmxaccamqshgvesieez`), so store sandbox events never write production
entitlements. Production gets its own webhook on `tenrvaghaspwdvnwvgrh` when
you are ready to take real money. Both need the matching project's
`REVENUECAT_API_KEY` secret set — without it the function cannot re-read the
subscriber and every delivery will 500. See [ENVIRONMENTS.md](./ENVIRONMENTS.md).

Two repository secrets drive the nightly job:

| Secret | Value |
| --- | --- |
| `SUPABASE_FUNCTIONS_URL` | `https://<project>.supabase.co/functions/v1` |
| `RECONCILE_SECRET` | Same value as the Supabase secret above |

The workflow holds only `RECONCILE_SECRET`. The RevenueCat key and the service-role
key stay in Supabase, so a leak in Actions cannot read the database or the billing
account.

## Testing

The logic is separated from its I/O so it can be tested without a Postgres, a
RevenueCat account, or a network:

| File | Holds | Tested by |
| --- | --- | --- |
| `_shared/entitlement.ts` | RevenueCat customer → row mapping | `entitlement_test.ts` |
| `revenuecat-webhook/handler.ts` | Secret check, replay detection, failure handling | `handler_test.ts` |
| `reconcile-entitlements/reconcile.ts` | Who is due, what counts as changed | `reconcile_test.ts` |
| `*/index.ts` | Wiring only — no decisions | Not tested |

```bash
cd supabase/functions
deno task check   # fmt, lint, type check, test
```

CI runs the same checks whenever anything under `supabase/` changes.

The mapping tests are where the judgement calls are pinned down, and they are worth
reading as documentation: a grace period keeps access, an intro price is not a trial,
a refund revokes access before `expires_date` says it should, and an absent
`expires_date` means lifetime rather than expired.

## Reading entitlements from a client

Each client has exactly one accessor, and every Pro decision goes through it:

| Client | Accessor | Sources |
| --- | --- | --- |
| Mobile | `entitlementProvider` → `isProProvider` | `CustomerInfo` + `entitlements` |
| Web | `useEntitlement()` | `entitlements` |

Nothing reads `CustomerInfo` or the row directly. One accessor is the whole point: a
second place that decides what "Pro" means is a second place to forget to update.

### Why mobile merges two sources

Each is wrong on its own.

`CustomerInfo` is correct the instant a purchase completes and readable offline from
the SDK's cache, but it only knows what *this* store account bought — a subscription
purchased on the other platform is invisible to it. The `entitlements` row is
platform-independent and authoritative, but it lags a purchase by a webhook round trip
and needs a network.

So mobile grants access when **either** says so. The asymmetry is deliberate:
withholding Pro from somebody who paid produces a support ticket and a refund, while
briefly granting it to somebody whose refund has not propagated costs nothing, and the
two converge within seconds. For the same reason, a device answer that is missing —
still loading, or the SDK threw — is treated as "this device knows of no purchase"
rather than as an answer, so one failed store lookup cannot revoke a confirmed
subscriber's access.

Two things only one source knows:

- **`willRenew` and the store management link** come from `CustomerInfo`. The row
  records an expiry but not renewal intent, so for a subscription bought on the other
  platform the UI says "Active until the 14th" rather than guessing at "Renews" or
  "Access ends", and hides the Customer Center — StoreKit cannot manage a Play
  subscription.
- **Where it was bought** comes only from the row, which is what lets the app say
  "Purchased through Google Play. Manage it there."

### Web reads and never writes

Web has no device-side source — a browser cannot hold a store receipt — so
`useEntitlement()` is the row and nothing else. It starts `loading`, and gates stay
closed until the row is read, so a subscriber never sees a flash of the free tier.

Web cannot sell Pro either: purchases live in the apps, so a free customer is told
where to buy rather than offered a checkout that does not exist. Do **not** put a
purchase link in the iOS build without the StoreKit External Purchase Link
entitlement, which carries US-storefront-only gating and 15-day transaction reporting.

### The free tier is enforced twice, on purpose

Both clients apply the caps in `packages/contracts/free_limits.json`, and both enforce
the trade window by tombstoning the oldest rows. That is why the numbers are a shared
contract rather than a constant in each codebase: if web kept twelve trades and mobile
ten, every sync would delete two, which from the customer's side is the app losing
their history.

Web reads the entitlement from the database when it trims, not from whatever the UI
last rendered. A limit decided by client state is not a limit.
