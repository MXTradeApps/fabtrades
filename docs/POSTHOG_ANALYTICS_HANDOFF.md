# PostHog Analytics Implementation — Handoff

**Audience:** implementation agent (no prior context on this repo).
**Goal:** instrument the FAB Trades Flutter mobile app with PostHog product analytics. There is currently **zero analytics on mobile** (the React web app has Google Analytics only — web is out of scope for this pass, see "Out of scope / follow-ups" at the end).

**Philosophy:** track generously. Every meaningful user action listed below gets an event. It is much easier to ignore an event than to backfill one.

---

## 1. Context you need

### Stack

| Thing | Value |
|---|---|
| App | Flutter (iOS + Android), `apps/mobile/`, bundle `com.fabtrades.app` |
| State | Riverpod (`flutter_riverpod`), central wiring in `apps/mobile/lib/core/providers.dart` |
| Backend | Supabase (auth + data). Init in `apps/mobile/lib/main.dart` |
| Subscriptions | RevenueCat (`purchases_flutter` + `purchases_ui_flutter`), entitlement **"FABTrades Pro"** |
| Navigation | Plain `Navigator` + `MaterialPageRoute` + modal bottom sheets. **No go_router.** Bottom tabs live in `HomeShell` in `apps/mobile/lib/app/app.dart` |
| Env config | `--dart-define-from-file` with `apps/mobile/env/production.json` and `apps/mobile/env/staging.json` (see `apps/mobile/env/README.md`). iOS defines synced via `apps/mobile/tool/sync_ios_dart_defines.sh` |

### What the app does

FAB Trades is a Flesh and Blood TCG companion: users price-check cards, balance trades between two parties, keep a card **binder** and **want list**, **scan** physical cards with the camera, and track **lend/borrow** with friends. **Find Trade Filler** is free. A **Pro** subscription (RevenueCat) unlocks full price history and lifts free-tier caps (binder 50 distinct cards, want list 50, 10 loaned cards, 3 saved trades — see `packages/contracts/free_limits.json`).

### Identity model

- Supabase Auth: Apple (native), Google/Discord (OAuth deep link), email/password. Files: `apps/mobile/lib/core/data/auth_repository.dart`, `apps/mobile/lib/features/auth/sign_in_sheet.dart`.
- The Supabase user UUID is already used as the RevenueCat `app_user_id` (bound in `purchasesIdentityProvider`, watched from `apps/mobile/lib/features/sync/sync_host.dart`). **Use the same UUID as the PostHog distinct ID** so all three systems agree.
- Account stream: `accountProvider` (`StreamProvider<Account?>`); `Account` model in `apps/mobile/lib/core/models/account.dart` has `id`, `email`, `displayName`, `provider`.
- Pro status: `isProProvider` / `entitlementProvider`; free-tier usage counters: `freeUsageProvider`.
- The app works fully signed-out. Most users will start anonymous and may sign in later — PostHog's `identify()` merges the anonymous history automatically.

### PostHog destination

- Project: **"Default project"**, org **MXTrades**, PostHog US Cloud — https://us.posthog.com/project/530196
- Project API key (client-side, safe to ship): `phc_vwZeKtRGcGbQjotwKxYDrX2CurGwoCJkA5nfJdzs95EF`
- Host: `https://us.i.posthog.com`
- The project has never ingested an event, so there are no existing naming conventions to respect.

---

## 2. SDK installation & initialization

### 2.1 Add the dependency

In `apps/mobile/`, run:

```bash
flutter pub add posthog_flutter
```

(Latest is ^5.x. Do not hand-edit `pubspec.yaml` versions.)

### 2.2 Disable native auto-init (we init manually from Dart)

We must initialize manually because the API key comes from dart-defines, not hardcoded plist/manifest values.

`apps/mobile/android/app/src/main/AndroidManifest.xml` — inside `<application>`:

```xml
<meta-data android:name="com.posthog.posthog.AUTO_INIT" android:value="false" />
```

`apps/mobile/ios/Runner/Info.plist`:

```xml
<key>com.posthog.posthog.AUTO_INIT</key>
<false/>
```

Platform minimums: Android `minSdkVersion` must be ≥ 23 (`apps/mobile/android/app/build.gradle`), iOS platform ≥ 13.0 (`apps/mobile/ios/Podfile`). The app already uses camera + ML Kit so these are almost certainly satisfied — verify, don't assume.

### 2.3 Env config

Add to **both** `apps/mobile/env/production.json` and `apps/mobile/env/staging.json`:

```json
"POSTHOG_API_KEY": "phc_vwZeKtRGcGbQjotwKxYDrX2CurGwoCJkA5nfJdzs95EF",
"POSTHOG_HOST": "https://us.i.posthog.com"
```

Use the same project for both environments — every event carries an `app_env` super property (below) so staging traffic can be filtered out. After editing, follow `apps/mobile/env/README.md` (run `tool/sync_ios_dart_defines.sh` if the iOS scheme needs re-syncing).

Create `apps/mobile/lib/core/config/posthog_config.dart` mirroring the existing `supabase_config.dart` / `revenuecat_config.dart` pattern. Name the class `PostHogEnv` (not `PostHogConfig`) because the posthog_flutter SDK exports a class called `PostHogConfig` and the collision is annoying:

```dart
abstract final class PostHogEnv {
  static const apiKey = String.fromEnvironment('POSTHOG_API_KEY');
  static const host = String.fromEnvironment(
    'POSTHOG_HOST',
    defaultValue: 'https://us.i.posthog.com',
  );
  static bool get isConfigured => apiKey.isNotEmpty;
}
```

### 2.4 Analytics service (single wrapper, no raw SDK calls in features)

Create `apps/mobile/lib/core/analytics/analytics.dart`. All feature code calls this service — never `Posthog()` directly. This gives one place for the no-op guard (missing key ⇒ analytics silently off, matching how RevenueCat degrades), naming consistency, and fire-and-forget semantics (never `await` a capture in UI code; never let analytics throw).

```dart
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import '../config/posthog_config.dart';

final analyticsProvider = Provider<Analytics>((ref) => Analytics());

class Analytics {
  bool get _enabled => PostHogEnv.isConfigured;

  void capture(String event, [Map<String, Object>? properties]) {
    if (!_enabled) return;
    Posthog()
        .capture(eventName: event, properties: properties)
        .catchError((Object e) => debugPrint('analytics: $e'));
  }

  void screen(String name, [Map<String, Object>? properties]) {
    if (!_enabled) return;
    Posthog()
        .screen(screenName: name, properties: properties)
        .catchError((Object e) => debugPrint('analytics: $e'));
  }

  Future<void> identify({
    required String userId,
    Map<String, Object>? userProperties,
  }) async { /* guard + Posthog().identify(...) */ }

  Future<void> reset() async { /* guard + Posthog().reset() */ }

  Future<void> register(String key, Object value) async { /* guard + Posthog().register(...) */ }

  void captureException(Object error, StackTrace stack,
      [Map<String, Object>? properties]) { /* guard + Posthog().captureException(...) */ }
}
```

(Flesh out the elided methods with the same guard + catchError pattern.)

### 2.5 Initialize in `main.dart`

`apps/mobile/lib/main.dart` currently: `WidgetsFlutterBinding.ensureInitialized()` → Supabase init → SharedPreferences → `PurchasesRepository().configure()` → `runApp(ProviderScope(...))`. Insert PostHog setup **inside the existing try block, after RevenueCat configure, before `runApp`**, and like RevenueCat it must never throw (wrap in its own try/catch):

```dart
if (PostHogEnv.isConfigured) {
  try {
    final phConfig = PostHogConfig(PostHogEnv.apiKey); // PostHogConfig is the SDK's class
    phConfig.host = PostHogEnv.host;
    phConfig.debug = kDebugMode;
    phConfig.personProfiles = PostHogPersonProfiles.identifiedOnly;
    // captureApplicationLifecycleEvents (Application Opened/Backgrounded/Installed/Updated) is on by default
    await Posthog().setup(phConfig);
    await Posthog().register('app_env', SupabaseConfig.appEnv); // or however APP_ENV is exposed in supabase_config.dart — check it
  } catch (e, s) {
    debugPrint('PostHog setup failed: $e\n$s');
  }
}
```

Also register these super properties once known (they ride on every event):

- `app_env` — at setup (above)
- `is_pro` — update whenever `isProProvider` changes (see §4)
- `app_version` — from `package_info_plus` (already a dependency)

### 2.6 Screen tracking

Two mechanisms, both required:

1. **`PosthogObserver` on the root navigator.** In `FabTradesApp` (`apps/mobile/lib/app/app.dart`), add to `MaterialApp`: `navigatorObservers: [PosthogObserver()]`. **Routes are only recorded if named** — audit every `MaterialPageRoute`/`showModalBottomSheet` push in the app and add `settings: RouteSettings(name: '...')` with human-readable names: `Card Detail`, `Scan`, `Trade History`, `Account`, `Settings`, `Set Cards`, `Card Picker`, `Lend Group`, `Sign In Sheet`, `Welcome Carousel`, etc. Grep for `MaterialPageRoute` and `showModalBottomSheet` across `apps/mobile/lib/` to find them all.
2. **Manual `screen()` for bottom tabs.** Tab switches in `HomeShell` don't go through the Navigator, so the observer never sees them. In the tab-change handler in `apps/mobile/lib/app/app.dart`, call `analytics.screen(<'Browse'|'Trade'|'Binder'|'Lend'>)`.

---

## 3. Event taxonomy

### Conventions

- Event names: **snake_case, `object_verb(past tense)`** — e.g. `trade_confirmed`, `card_scanned`. Consistent, greppable, one style everywhere.
- Property names: snake_case.
- Never put free-text user content in properties where avoidable: send `query_length` and `results_count` rather than raw search text (raw `search_query` is acceptable — card names aren't PII — include it, it's useful for demand analysis).
- Where an action can originate from multiple places, always include a `source` property (e.g. `source: 'scan' | 'search' | 'card_detail'`). This is the single most valuable disambiguator.
- Counts/amounts as numbers, not strings. Monetary values in whole cents or as doubles — pick one and stick to it (recommend doubles in USD/EUR as displayed, plus `price_source`).

Exact trigger sites below name the file; find the specific handler inside it (button `onPressed`, provider method, etc.). Prefer instrumenting **the provider/repository method that performs the action** over the button widget, so all entry points are covered — but keep UI-context properties (like `source`) by passing them in.

### 3.1 Onboarding & app lifecycle

Automatic (free): `Application Opened`, `Application Backgrounded`, `Application Installed`, `Application Updated`.

| Event | Trigger / file | Properties |
|---|---|---|
| `onboarding_started` | `WelcomeCarousel` first shown — `apps/mobile/lib/features/onboarding/welcome_carousel.dart` | — |
| `onboarding_page_viewed` | carousel page change | `page_index` |
| `onboarding_completed` | user finishes carousel (gate flips to `HomeShell`) | `signed_in` (bool — did they use the page-3 sign-in CTA) |
| `onboarding_skipped` | skip action, if one exists | `page_index` |
| `tutorial_replayed` | Settings → replay tutorial — `apps/mobile/lib/features/settings/settings_screen.dart` | — |
| `update_prompt_shown` | `apps/mobile/lib/features/update/update_prompt.dart` | `latest_version`, `current_version` |
| `update_prompt_accepted` / `update_prompt_dismissed` | same file | same |

### 3.2 Auth

| Event | Trigger / file | Properties |
|---|---|---|
| `sign_in_sheet_shown` | `SignInSheet` presented — `apps/mobile/lib/features/auth/sign_in_sheet.dart` | `source` (`account`, `paywall`, `welcome_carousel`, …) |
| `sign_in_started` | provider button tapped | `provider` (`apple`/`google`/`discord`/`email`) |
| `signed_in` | success path in `apps/mobile/lib/core/data/auth_repository.dart` (or on `accountProvider` transition null→user) | `provider`, `is_new_user` if determinable |
| `sign_in_failed` | catch blocks in `auth_repository.dart` / sheet | `provider`, `error_type` (no raw messages with PII) |
| `signed_out` | `AuthRepository.signOut()` call site in `apps/mobile/lib/features/settings/account_screen.dart` | — |

### 3.3 Browse / search / card detail

| Event | Trigger / file | Properties |
|---|---|---|
| `search_performed` | search submit/debounce in `apps/mobile/lib/features/search/search_screen.dart` — debounce so you capture settled queries, not every keystroke | `search_query`, `query_length`, `results_count` |
| `set_opened` | set tile → `SetCardsScreen` | `set_id`, `set_name` |
| `card_detail_viewed` | `CardDetailScreen` opened — `apps/mobile/lib/features/card_detail/card_detail_screen.dart` | `card_id`, `card_name`, `source` (`search`/`set`/`scan`/`binder`/`trade`/`want_list`) |
| `card_printing_switched` | printing selector — `card_detail_screen.dart` / `apps/mobile/lib/app/printing_picker.dart` | `card_id` |
| `prices_refreshed` | pull-to-refresh in `search_screen.dart` | — |

### 3.4 Card scan

| Event | Trigger / file — all in `apps/mobile/lib/features/scan/scan_screen.dart` | Properties |
|---|---|---|
| `scan_opened` | screen opened | `destination` (`detail`/`trade_theirs`/`trade_mine`/`binder`) |
| `card_scanned` | match locked | `card_id`, `card_name`, `destination` |
| `scan_card_added` | user confirms add after lock | `card_id`, `destination` |
| `scan_failed` | recognition gave up / user backs out with no match — instrument whatever failure signal exists | `destination` |
| `scan_permission_denied` | camera permission denied | — |

### 3.5 Trade balancer (core feature — instrument thoroughly)

Files: `apps/mobile/lib/features/trade/trade_screen.dart`, `apps/mobile/lib/core/logic/confirm_trade.dart`, `tradeDraftProvider` / `tradeHistoryProvider` in `apps/mobile/lib/core/providers.dart`, `apps/mobile/lib/features/trade/trade_filler_sheet.dart`, `trade_history_screen.dart`.

| Event | Trigger | Properties |
|---|---|---|
| `trade_card_added` | card added to either side (instrument the draft provider so search-picker, scan, and card-detail entry points are all covered) | `side` (`theirs`/`mine`), `source` (`search`/`scan`/`card_detail`), `card_id` |
| `trade_card_removed` | card removed from draft | `side` |
| `trade_quantity_changed` | qty stepper | `side`, `new_quantity` |
| `trade_cash_adjusted` | cash field changed | `side`, `amount` |
| `trade_cleared` | clear-trade action | `their_card_count`, `my_card_count` |
| `trade_filler_opened` | filler sheet opened — `trade_filler_sheet.dart` | `value_gap` |
| `trade_filler_applied` | filler suggestions accepted | `cards_added`, `value_gap_before`, `value_gap_after` |
| `trade_confirm_opened` | Confirm Trade sheet shown — `trade_screen.dart` | value/count props below |
| `trade_confirmed` | confirm executed — `confirm_trade.dart` | `their_card_count`, `my_card_count`, `their_value`, `my_value`, `cash_amount`, `value_diff`, `binder_reconciled` (bool), `price_source` |
| `trade_history_viewed` | `TradeHistoryScreen` opened | `trade_count` |
| `trade_deleted` | history item deleted | — |

`trade_confirmed` is the app's north-star event — get its properties right.

### 3.6 Binder & want list

Files: `apps/mobile/lib/features/binder/binder_screen.dart`, `apps/mobile/lib/features/want_list/want_list_screen.dart`, `apps/mobile/lib/app/card_actions.dart`, `apps/mobile/lib/features/paywall/pro_limits.dart`.

| Event | Trigger | Properties |
|---|---|---|
| `binder_card_added` | add succeeds (instrument the repository/provider method behind `addToBinderOrUpsell`) | `card_id`, `source` (`scan`/`search`/`card_detail`), `binder_size_after` |
| `binder_card_updated` | qty/condition edit | `card_id`, `field` (`quantity`/`condition`) |
| `binder_card_removed` | removal | `card_id` |
| `want_list_card_added` | add to want list (from card detail or actions sheet) | `card_id`, `source`, `want_list_size_after` |
| `want_list_card_removed` | removal | `card_id` |
| `free_limit_hit` | any free-tier cap blocks an action — `pro_limits.dart` is the choke point | `limit_type` (`binder`/`want_list`/`lend`/`trade_history`), `current_count`, `limit` |

`free_limit_hit` is the top of the monetization funnel — it must fire every time a cap blocks the user, immediately before the paywall is offered.

### 3.7 Lend / borrow

Files: `apps/mobile/lib/features/lend/lend_screen.dart`, `lend_group_screen.dart`, `person_name_dialog.dart`.

| Event | Trigger | Properties |
|---|---|---|
| `lend_group_created` | new batch confirmed | `type` (`loan`/`borrow`), `card_count`. **Do not send the person's name** — it's a real person's PII. |
| `lend_card_added` | card added to existing group | `type` |
| `lend_group_returned` | marked returned | `type`, `card_count`, `days_outstanding` if cheap to compute |
| `lend_group_deleted` | deleted | `type` |

### 3.8 Monetization (client side)

Files: `apps/mobile/lib/features/paywall/pro_paywall.dart`, `pro_gate.dart`, `apps/mobile/lib/core/data/purchases_repository.dart`, `apps/mobile/lib/features/settings/subscription_section.dart`.

The paywall and Customer Center are **native RevenueCat UI** — you cannot instrument inside them. Instrument around them: capture before presenting, then map the returned `PaywallResult` / restore result to an event.

| Event | Trigger | Properties |
|---|---|---|
| `paywall_shown` | right before `RevenueCatUI` paywall presented (`ensurePro` / `pro_gate.dart` path) | `trigger` (`price_history`/`binder_limit`/`want_list_limit`/`lend_limit`/`trade_history_limit`/`settings`) |
| `purchase_completed` | `PaywallResult.purchased` | `trigger`, plus product id if the result exposes it |
| `purchase_restored` | `PaywallResult.restored` or explicit restore in `subscription_section.dart` | — |
| `paywall_dismissed` | `PaywallResult.cancelled` / closed without purchase | `trigger` |
| `purchase_failed` | error result | `trigger`, `error_type` |
| `customer_center_opened` | Customer Center presented from `subscription_section.dart` | — |

### 3.9 Sync & settings

Files: `apps/mobile/lib/features/sync/sync_host.dart`, `apps/mobile/lib/core/sync/`, `apps/mobile/lib/features/settings/settings_screen.dart`, `account_screen.dart`.

| Event | Trigger | Properties |
|---|---|---|
| `sync_completed` | successful sync pass | `trigger` (`sign_in`/`manual`/`auto`), `duration_ms` if cheap |
| `sync_failed` | sync error (also `captureException` here) | `trigger`, `error_type` |
| `price_source_changed` | Settings toggle | `price_source` (`tcgplayer`/`cardmarket`) |
| `theme_changed` | dark-mode toggle | `theme` |

### 3.10 Error tracking

Add `analytics.captureException(error, stack, {...})` in the catch blocks of the critical paths (do not remove existing error handling, add alongside):

- Auth: `auth_repository.dart` sign-in/out failures
- Sync: `core/sync/` failure paths
- Purchases: `purchases_repository.dart` configure/purchase/restore errors
- Trade confirm: `confirm_trade.dart`
- Scan pipeline: `core/scan/` fatal errors
- Bootstrap: the `catch` in `main.dart` (PostHog may not be initialized there — guard; skip if setup didn't run)

---

## 4. User identification

Follow the existing pattern: `SyncHost` (`apps/mobile/lib/features/sync/sync_host.dart`) already watches `accountProvider` to bind RevenueCat identity and trigger sync. Add an analytics identity watcher in the same place (or a sibling listener registered in `SyncHost`):

**On sign-in** (account transitions null → non-null):

```dart
await analytics.identify(
  userId: account.id, // Supabase UUID == RevenueCat app_user_id
  userProperties: {
    'email': account.email,
    'name': account.displayName,
    'auth_provider': account.provider,
  },
);
```

**Whenever entitlement changes** (watch `isProProvider` / `entitlementProvider`):

- `Posthog().register('is_pro', isPro)` — super property on every event, works for anonymous users too
- If identified, also set person properties: `is_pro`, `subscription_product`, `subscription_store`, `is_trial`, `expires_at` (fields available on the `Entitlement` model)

**On sign-out** (account transitions non-null → null): `await analytics.reset();` then re-register the super properties that survive sign-out (`app_env`, `app_version`, current `is_pro` — which will be false). `reset()` clears super properties, so re-registration is required.

Do **not** call `identify` repeatedly on every account stream emission — only on actual transitions (keep the previous value and compare, same as the RevenueCat binding does).

---

## 5. Server-side events (Supabase Edge Function)

Subscription lifecycle truth lives server-side. `supabase/functions/revenuecat-webhook/` already receives RevenueCat webhooks and updates the `entitlements` table. Add PostHog capture there via the HTTP API (no SDK needed in Deno):

```ts
// after successfully processing the webhook event
await fetch("https://us.i.posthog.com/i/v0/e/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: Deno.env.get("POSTHOG_API_KEY"),
    event: eventName, // see mapping below
    distinct_id: appUserId, // RevenueCat app_user_id == Supabase UUID == PostHog distinct id
    properties: {
      product_id: ...,
      store: ...,
      environment: ...,   // sandbox vs production from the webhook payload
      $lib: "revenuecat-webhook",
    },
  }),
});
```

Map RevenueCat webhook types → events: `INITIAL_PURCHASE` → `subscription_started`, `RENEWAL` → `subscription_renewed`, `CANCELLATION` → `subscription_cancelled`, `UNCANCELLATION` → `subscription_uncancelled`, `EXPIRATION` → `subscription_expired`, `BILLING_ISSUE` → `subscription_billing_issue`, `PRODUCT_CHANGE` → `subscription_product_changed`. Ignore other types. Failures to reach PostHog must **not** fail the webhook (fire-and-forget with catch + log).

Add `POSTHOG_API_KEY` to the Supabase Edge Function secrets (`supabase secrets set POSTHOG_API_KEY=phc_...` — note in the PR that this must be run against the production project; don't assume you can).

These server events are the source of truth for revenue analytics; the client-side §3.8 events measure the *funnel* (who saw the paywall and what they did).

---

## 6. Privacy & compliance (do not skip)

1. **No PII beyond identify:** person's names in Lend, raw emails in event properties — never. Email/name go only in `identify()` person properties.
2. **Scan stays on-device:** never send camera frames or OCR text to PostHog. Card IDs/names after a match are fine.
3. **Privacy policy:** the current policy (web `apps/web/src/pages/PrivacyPolicy.jsx` and whatever the app links from Settings) mentions Google Analytics for the website only. It must be updated to disclose PostHog analytics in the mobile app. Flag this in the PR description — the text change may need the owner's sign-off; make a reasonable draft edit.
4. **App Store privacy labels:** adding analytics changes the App Privacy declaration (Identifiers → User ID, Usage Data → Product Interaction; "not linked to user" becomes "linked" for signed-in users). This is done in App Store Connect, not code — **call it out prominently in the PR/handback notes**, especially since there's an active App Store resubmission in flight (`docs/APP_STORE_RESUBMISSION_HANDOFF.md`).
5. **No ATT prompt needed:** PostHog is first-party analytics, no cross-app tracking, so App Tracking Transparency is not triggered. Do not add the ATT prompt.
6. Google Play Data Safety form needs the equivalent update (also a console task, note it).

---

## 7. Suggested implementation order

1. SDK install + platform config + env files + `posthog_config.dart` (§2.1–2.3)
2. `Analytics` service + provider (§2.4)
3. `main.dart` init + super properties (§2.5)
4. Identity watcher in `SyncHost` (§4)
5. Screen tracking: `PosthogObserver` + name all routes + tab `screen()` calls (§2.6)
6. Events, in value order: monetization (§3.8, §3.6 `free_limit_hit`) → trade (§3.5) → auth (§3.2) → scan (§3.4) → binder/want (§3.6) → browse (§3.3) → lend (§3.7) → onboarding/sync/settings (§3.1, §3.9)
7. Exception capture (§3.10)
8. Edge Function server events (§5)
9. Privacy policy draft + PR notes for store consoles (§6)

## 8. Verification

- Run the app in debug (`config.debug = kDebugMode` gives verbose SDK logs). Exercise: onboarding → search → card detail → add to binder until the free cap fires → paywall → scan → build and confirm a trade → sign in → sign out.
- Confirm events arrive in PostHog Activity: https://us.posthog.com/project/530196/activity/explore
- Verify: anonymous events exist before sign-in; after `identify`, the person shows the merged pre-sign-in history; `app_env`, `is_pro`, `app_version` present on every event; `$screen` events fire for pushed routes **and** tab switches; no event contains lend person names or raw emails.
- `flutter analyze` clean; run any existing test suite (`flutter test` in `apps/mobile/`).

## 9. Out of scope / follow-ups (do not do now)

- Web app (`apps/web/`) PostHog via `posthog-js` — decide GA coexistence first.
- Session replay (`config.sessionReplay`) — deliberate opt-in later; has privacy-policy implications.
- Feature flags / experiments — the SDK supports them once installed; nothing to do now.
- PostHog dashboards (activation funnel, paywall conversion, retention) — build after events flow.
