# Store setup

Configuring FABTrades Pro in App Store Connect, Play Console, and RevenueCat.

This is the one part of the subscription system that cannot live in the repo, so it is
written as a checklist with the exact identifiers the app expects. Everything here is
done once. The code that consumes it is
[revenuecat_config.dart](../apps/mobile/lib/core/config/revenuecat_config.dart), and
the server side is [ENTITLEMENTS.md](./ENTITLEMENTS.md).

## Identifiers

| Thing | Value |
| --- | --- |
| iOS bundle id | `com.fabtrades.app` |
| Android application id | `fabtrades.myapp` |
| RevenueCat entitlement | `FABTrades Pro` |
| App Store products | `com.fabtrades.app.pro.monthly`, `com.fabtrades.app.pro.yearly` |
| Play subscriptions | `pro_monthly`, `pro_yearly` |
| Play base plans | `monthly-autorenewing`, `annual-autorenewing` |
| Offering | `default`, with `$rc_monthly` and `$rc_annual` packages |

Two things about that table are worth reading twice.

**The Android application id is `fabtrades.myapp`, and it is permanent.** The
namespace is `com.fabtrades.fabtrades` and iOS is `com.fabtrades.app`, so it looks
like a mistake. It is not one that can be corrected: a build has already shipped to a
closed track, and Play binds an app to its application id forever. Changing it would
orphan the listing, its testers, and every subscription bought against it. Configure
Play products and the RevenueCat Android app against `fabtrades.myapp`.

**The product ids differ per store on purpose.** Apple requires product ids to be
unique across the entire developer account — which this app shares with another
product — so they are namespaced. Play scopes ids to the app, and reports them to
RevenueCat as `subscription:base_plan` (for example
`pro_monthly:monthly-autorenewing`). The app knows all of these; see
`RevenueCatConfig.monthlyProductIds`.

## 1. App Store Connect

Under **Monetization → Subscriptions**, create one subscription group — call it
`FABTrades Pro`. Both plans must live in the *same* group, or a customer cannot
upgrade from monthly to yearly without cancelling first.

In that group create two auto-renewable subscriptions:

| Product ID | Reference name | Duration |
| --- | --- | --- |
| `com.fabtrades.app.pro.monthly` | FABTrades Pro Monthly | 1 month |
| `com.fabtrades.app.pro.yearly` | FABTrades Pro Yearly | 1 year |

For each one: set a price, add a localization (display name and description — these
are what App Review reads), and set the **Subscription Display Name** and group
display name, which appear in the customer's iOS subscription management screen.

Product ids cannot be reused after deletion, so get them right the first time.

Then, still in App Store Connect:

- **Paid Apps Agreement**: Account Holder → Business → Paid Apps Agreement must
  be **Active**, with tax and banking completed. Sandbox purchases fail with
  StoreKit error 2 ("There was a problem with the App Store") when this is
  missing or expired.
- **In-App Purchase key**: Users and Access → Integrations → In-App Purchase. Create
  a key, download the `.p8` (once only), and note the key id and issuer id.
- **App-Specific Shared Secret**: on the app's page, under General → App Information.
  RevenueCat needs this for receipt validation.

Also add at least one **Sandbox tester** under Users and Access → Sandbox. Use an
email address that is not already an Apple ID.

### Submit the subscriptions with the app version

Both products stay in **Ready to Submit** until they are attached to a version
and that version is submitted. On the first IAP submission:

1. App Store Connect → the version → **In-App Purchases and Subscriptions**
2. Add `com.fabtrades.app.pro.monthly` and `com.fabtrades.app.pro.yearly`
3. Submit the version. Apple reviews the IAPs with the binary.

Sandbox and App Review can fetch product prices before that, but a purchase
often fails with StoreKit error 2 if the products were never submitted with a
version, or if the Paid Apps Agreement is not Active.

### Legal metadata (required for auto-renewable subscriptions)

App Review rejects subscriptions that lack a functional Terms of Use (EULA) link
in the app metadata. Before every submission:

| Field | Value |
| --- | --- |
| Privacy Policy URL | `https://fabtrades.net/privacy` |
| Terms of Use (EULA) | `https://fabtrades.net/terms` |
| App Description | Must include the Terms URL (and preferably Privacy) |

Full App Review paste text, demo account setup, and Notes for Review live in
[APP_STORE_REVIEW.md](./APP_STORE_REVIEW.md).

## 2. Play Console

Under **Monetize → Products → Subscriptions**, create two subscriptions:

| Subscription ID | Name | Base plan | Billing period |
| --- | --- | --- | --- |
| `pro_monthly` | FABTrades Pro Monthly | `monthly-autorenewing` | 1 month |
| `pro_yearly` | FABTrades Pro Yearly | `annual-autorenewing` | 1 year |

Each base plan must be **auto-renewing** and **activated** — a base plan left in draft
is invisible to the app, which shows up as an empty paywall with no error anywhere.

Set prices, then activate the subscriptions themselves. A subscription with no active
base plan is not purchasable.

Add testers under **Setup → License testing** so purchases are free and renew on an
accelerated schedule (a monthly plan renews every 5 minutes, which is the only
practical way to test a renewal).

## 3. RevenueCat project

One project, two apps in it: an App Store app and a Play Store app. Do **not** create
two projects — a single project with two apps is what makes one `app_user_id` map to
one customer across both stores, which is the whole basis of the entitlement design.

### App Store app

- Bundle id: `com.fabtrades.app`
- Upload the In-App Purchase `.p8` key, key id, and issuer id
- Paste the app-specific shared secret

### Play Store app

- Package name: `fabtrades.myapp`
- Upload the Google Cloud service account JSON

The service account needs the **Pub/Sub Admin** role in Google Cloud (so RevenueCat
can wire up notifications) and access to the app in Play Console under **Users and
permissions**. Enable three APIs in the Google Cloud project first: Google Play
Developer, Play Developer Reporting, and **Cloud Pub/Sub**. Forgetting Pub/Sub
produces a specific error when connecting Play, and it is the most commonly missed
step.

Play can take up to 24 hours to recognise a newly granted service account.

### Entitlement, products, offering

1. **Entitlement**: identifier `FABTrades Pro`. This string is in the app and in the
   Edge Functions; it must match exactly, spaces included. A mismatch means Pro never
   unlocks and nothing logs an error — the app warns about this in debug builds only.
2. **Products**: import all four (two per store). Attach every one to the
   `FABTrades Pro` entitlement.
3. **Offering**: one offering, identifier `default`, marked **Current**. Add two
   packages using the predefined identifiers `$rc_monthly` and `$rc_annual`, and
   attach both stores' products to each. The app resolves plans by package type
   first, so this is what makes a single code path work on both stores.

## 4. Server notifications

Without these, RevenueCat only learns about a subscription when the app happens to
open. Renewals, cancellations, and refunds all arrive this way.

### Apple

In the RevenueCat dashboard, on the App Store app's settings page, find **Apple Server
to Server notification settings** and click **Apply in App Store Connect** — it
configures both URLs at Version 2 for you.

Manually, if that fails: copy the **Apple Server Notification URL** from RevenueCat
into App Store Connect → App Information → App Store Server Notifications, in *both*
the Production and Sandbox URL fields, selecting **Version 2**.

Apple allows only one URL per environment, so both must point at RevenueCat. If you
also want them on your own server, use RevenueCat's forwarding URL rather than trying
to split the pipe at Apple's end. Setting only the sandbox URL means **no production
notifications at all**.

### Google

1. RevenueCat dashboard → the Play Store app → **Connect to Google**. It shows a
   Pub/Sub topic id like `projects/revenuecat-*/topics/rc-*`. Copy it. (Refresh the
   page if it does not appear.)
2. Play Console → **Monetize → Monetization setup → Real-time developer
   notifications**. Paste the topic id into **Topic name**, and set notification
   content to **Subscriptions, voided purchases, and all one-time products**. Save.
3. Click **Send test notification**, then check RevenueCat for a recent
   **Last received** timestamp.

If the test fails, grant `google-play-developer-notifications@system.gserviceaccount.com`
the **Pub/Sub Publisher** role on that specific topic. A Domain Restricted Sharing
organization policy in Google Cloud will also block it.

## 5. Connect RevenueCat to Supabase

The remaining wiring — the webhook, its shared secret, and the nightly reconciliation
job — is in [ENTITLEMENTS.md](./ENTITLEMENTS.md#configuration). Do that step after the
products exist, so the first test purchase has something to write.

## Verifying it worked

In order, because each step depends on the last:

1. **Offerings load.** Run a release-mode build with a real API key. An empty paywall
   means products are not attached to the current offering, or a Play base plan is
   still in draft.
2. **A sandbox purchase completes** and Pro unlocks immediately. This is
   `CustomerInfo` from the SDK, not the database — it proves the store and RevenueCat
   agree.
3. **The entitlement row appears** in Supabase with `is_sandbox = true`. This proves
   the webhook fired and `Purchases.logIn` bound the right identity. If the purchase
   worked but no row appeared, check the function logs before touching store config.
4. **A renewal updates `expires_at`.** Play's license testers renew a monthly plan
   every 5 minutes; Apple's sandbox does it every 5 minutes too, up to six times.
5. **Cancelling revokes access** at the end of the period, not immediately — that is
   correct behaviour, not a bug.

Debug builds skip all of this: they run against RevenueCat's Test Store, which
simulates purchases without any store setup at all. That is deliberate, and it means a
broken store configuration cannot be discovered in debug — only in a release build.
