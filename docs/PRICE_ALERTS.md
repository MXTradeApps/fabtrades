# Price alerts

On a card's detail page, a signed-in user can ask to be told when that printing
**rises to** or **drops to** a price. Their alerts are listed under **More → Price
Alerts**, fired ones first.

## How it works

```
card detail ──insert──▶ fab_price_alerts (RLS: own rows)
                                │
update-prices.yml: ingest ──▶ price-alerts Edge Function
                                ├─ fab_fire_price_alerts()   stamps triggered_at
                                ├─ PostHog price_alert_triggered
                                └─ FCM push to fab_push_tokens, then notified_at
```

- **Which price.** The alert stores the marketplace the user had selected when they
  set it (`tcgplayer` → TCGplayer market in USD, `cardmarket` → CardMarket trend in
  EUR, the foil trend for a foil printing). The comparison in
  `fab_fire_price_alerts` uses the same fallbacks as the app's `Pricing.value`, so
  the number in the notification is the number on the card page.
- **When.** Prices update once a day (06:00 UTC), so alerts are checked once a day,
  right after the ingest.
- **Once.** An alert fires once and stays in the list as *Hit*. *Watch again*
  re-arms it.
- **Delivery is retried, firing is not.** Firing is a single SQL statement. The push
  step reads every fired alert without `notified_at` from the last three days, so a
  failed push is retried on the next run, and an alert older than that is not
  pushed at all (it still shows in the app).
- **More than three alerts** for one person in one run become a single summary push.
- **Signed out**: alerts need an account, because the server fires them. The sheet
  asks the user to sign in first.
- Each user can have at most 200 alerts (a trigger enforces it).

## Analytics (PostHog)

App: `price_alert_sheet_opened`, `price_alert_created`, `price_alert_deleted`,
`price_alert_rearmed`, `price_alerts_viewed`, `price_alert_push_opened`,
`push_permission_result`. Server: `price_alert_triggered` (needs `POSTHOG_API_KEY`
on the function, the same key `revenuecat-webhook` uses).

## Setup

Without any of this, the feature still works in the app: alerts are created and
listed, and they show as *Hit* once the function runs. Push is the part that needs
Firebase.

Done for the `fab-trades` Firebase project on 2026-10-19: steps 2 and the
`FCM_SERVICE_ACCOUNT` secret.

1. **Database.** Apply `supabase/migrations/20261019220000_fab_price_alerts.sql`.
2. **Firebase project.** Create one (or reuse one), add an iOS app
   (bundle id `com.fabtrades.app`) and an Android app (package `fabtrades.myapp`).
   - iOS: upload an APNs auth key (Project settings → Cloud Messaging), and turn on
     the Push Notifications capability for the App ID. `Runner.entitlements`
     already carries `aps-environment`.
   - Copy the app ids, API key, sender id and project id into
     `apps/mobile/env/production.json`:
     ```json
     "FIREBASE_PROJECT_ID": "...",
     "FIREBASE_MESSAGING_SENDER_ID": "...",
     "FIREBASE_ANDROID_API_KEY": "...",
     "FIREBASE_ANDROID_APP_ID": "1:...:android:...",
     "FIREBASE_IOS_API_KEY": "...",
     "FIREBASE_IOS_APP_ID": "1:...:ios:...",
     "FIREBASE_IOS_BUNDLE_ID": "..."
     ```
     These are client identifiers and safe to commit, like the Supabase publishable
     key. No `google-services.json` / `GoogleService-Info.plist` is needed.
3. **Edge Function.**
   ```sh
   supabase secrets set PRICE_ALERTS_SECRET=$(openssl rand -hex 32)
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat firebase-service-account.json)"
   supabase functions deploy price-alerts
   ```
   The service account comes from Firebase → Project settings → Service accounts →
   Generate new private key.
4. **GitHub.** Add the `PRICE_ALERTS_SECRET` repository secret (same value).
   `SUPABASE_FUNCTIONS_URL` already exists for reconcile-entitlements. Until both
   are set, the step in `update-prices.yml` skips itself.
