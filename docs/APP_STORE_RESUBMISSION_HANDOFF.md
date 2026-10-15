# App Store resubmission handoff (July 2026)

Context for another agent continuing FAB Trades iOS App Store work after the
July 31, 2026 rejection. Read this first, then
[APP_STORE_REVIEW.md](./APP_STORE_REVIEW.md) for the ASC paste checklist.

## Rejection reasons (Apple)

Two automated App Review blockers:

1. **Missing Terms of Use (EULA) link in app metadata** — the app offers
   auto-renewable subscriptions (`FABTrades Pro`) but did not include a
   functional Terms of Use link in App Store metadata / description.
2. **Login without demo account** — automated analysis detected a login UI, but
   no username/password demo account was provided in App Review Information.

## Product facts that matter for review

| Topic | Reality |
| --- | --- |
| Bundle ID | `com.fabtrades.app` |
| ASC Apple ID | `6794308687` |
| Team ID | `923368MA8X` (JOSE MA GABRIEL REYES ESCALER) |
| Supabase (prod) | `tenrvaghaspwdvnwvgrh` (`https://tenrvaghaspwdvnwvgrh.supabase.co`) |
| RevenueCat project | `proj0720ad82` (FABTrades) |
| RevenueCat App Store app | `app42faae3984` |
| Entitlement | `FABTrades Pro` |
| Offering | `default` (current), paywall id `pwcd18b546262f4487` |
| Sign-in | Optional for core use. Required before Pro purchase. |
| Providers | Apple, Google, Discord, **email/password** (added for App Review) |
| Privacy URL | `https://fabtrades.net/privacy` |
| Terms URL | `https://fabtrades.net/terms` |
| Target version | **1.0.2** (build **5**) |

Login is **not** a hard gate for browsing/trading on-device. It is required when
buying Pro so RevenueCat can bind the purchase to a Supabase user
(`Purchases.logIn`).

## What was fixed in code / product

### 1. Terms of Use page (web)

- New content: `apps/web/src/content/termsOfUse.js`
- Page: `apps/web/src/pages/TermsOfUse.jsx`
- Route `/terms` in `apps/web/src/App.jsx`
- Header nav link in `apps/web/src/components/elements/Header.jsx`
- Static SEO prerender + sitemap entry in `apps/web/scripts/generateSeoPages.js`
- Terms cover FABTrades Pro auto-renew language (Apple-required subscription
  disclosures) plus standard EULA-style clauses

### 2. Privacy Policy updated (web)

- `apps/web/src/content/privacyPolicy.js` effective date → July 31, 2026
- Previously claimed the App had **no account system** and local-only data —
  that was false after mobile auth + sync + RevenueCat
- Now documents: optional Apple/Google/Discord/email auth, cloud sync,
  RevenueCat/store billing, third parties (Apple, Google, Discord, RevenueCat,
  Supabase)

### 3. In-app legal links (mobile)

- `apps/mobile/lib/core/config/legal_urls.dart` — canonical URLs
- Settings → Legal → Privacy Policy / Terms of Use
  (`settings_screen.dart`, opens via `url_launcher`)
- My Account → FABTrades Pro upgrade card → Privacy / Terms buttons
  (`subscription_section.dart`) for Guideline 3.1.2 near the offer

### 4. Email/password demo sign-in (mobile)

- `AuthRepository.signInWithEmail` → Supabase `signInWithPassword`
- `AuthProviderKind.email` added
- Sign-in sheet: **Sign in with email** expands email/password fields
  (`sign_in_sheet.dart`)
- Tests added in `apps/mobile/test/core/data/auth_repository_test.dart`
- Docs: `docs/AUTH_PROVIDERS.md`, `docs/APP_STORE_REVIEW.md`,
  `docs/STORE_SETUP.md`

### 5. RevenueCat paywall footer URLs

Previously pointed at RevenueCat’s own legal pages. Updated and **published**:

| Link | Now |
| --- | --- |
| Terms | `https://fabtrades.net/terms` |
| Privacy | `https://fabtrades.net/privacy` |

- Project: `proj0720ad82`
- Paywall: `pwcd18b546262f4487` (“FABTrades Pro”)
- Editor: https://app.revenuecat.com/projects/0720ad82/paywalls/pwcd18b546262f4487/builder

### 6. Version bump

- `apps/mobile/pubspec.yaml` → `1.0.2+5`
- Commit on `main`: `9aee6c81` — *Bump mobile to 1.0.2 for App Store resubmission.*
- Tag `mobile-v1.0.2` was pushed (triggers the Android closed release).
  iOS is built locally in Xcode/Flutter.

### 7. Local signing convenience (uncommitted)

`apps/mobile/ios/Runner.xcodeproj/project.pbxproj` was modified locally to set:

- `DEVELOPMENT_TEAM = 923368MA8X`
- `CODE_SIGN_STYLE = Automatic`

on Runner (Debug/Release/Profile) and RunnerTests. This is **modified but not
committed** as of this handoff (`git status` shows `M .../project.pbxproj`).

## What the human already completed (do not redo)

User confirmed they did these themselves:

1. Deployed web so `/terms` and updated `/privacy` are live
2. App Store Connect metadata (Privacy URL, Terms in description, etc.)
3. Created the demo account in Supabase / ASC App Review Information

Treat ASC legal fields + demo credentials as done unless something still fails
review.

## Local iOS build status

A **local** App Store IPA was built successfully:

```bash
cd apps/mobile
flutter build ipa \
  --release \
  --build-name=1.0.2 \
  --build-number=5 \
  --dart-define-from-file=env/production.json \
  --dart-define=REVENUECAT_APPLE_API_KEY=appl_AFlfynaUBJZlLTxCehZOVVRqGOn \
  --export-method=app-store
```

Artifacts:

| Artifact | Path |
| --- | --- |
| IPA | `apps/mobile/build/ios/ipa/fabtrades.ipa` (~49 MB) |
| Archive (build tree) | `apps/mobile/build/ios/archive/Runner.xcarchive` |
| Archive (Organizer) | `~/Library/Developer/Xcode/Archives/2026-07-31/FAB Trades 1.0.2 (5).xcarchive` |

RevenueCat **public** Apple SDK key (safe to embed in the client; not a secret
server key): `appl_AFlfynaUBJZlLTxCehZOVVRqGOn`  
(from RevenueCat → FABTrades App Store app `app42faae3984`).

Export options used `method = app-store-connect`, team `923368MA8X`, automatic
signing.

### Known problem: Xcode Organizer “Distribute App” missing

Symptoms:

- Opening the Flutter-built archive in Organizer does **not** show a normal
  **Distribute App** button (or only offers **Distribute Content**).

Root causes observed:

1. Flutter writes archives under `build/ios/archive/`, **not** under
   `~/Library/Developer/Xcode/Archives/…`, so Organizer may not list them until
   copied (copy already done once).
2. Archive `Info.plist` shows signing identity
   **`Apple Development: JOSE MA GABRIEL REYES ESCALER (…)`, not Apple
   Distribution**. Development-signed archives often break the App Store
   distribute UI in Organizer even when `flutter build ipa --export-method
   app-store` still produced a valid IPA.

**Recommended upload path (avoid Organizer):**

1. Install Apple **Transporter** from the Mac App Store:
   https://apps.apple.com/us/app/transporter/id1450874784
2. Deliver `apps/mobile/build/ios/ipa/fabtrades.ipa`
3. Or upload with ASC API key:

   ```bash
   xcrun altool --upload-app --type ios \
     -f apps/mobile/build/ios/ipa/fabtrades.ipa \
     --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>
   ```

Upload was **not** completed in the prior session (credential/external-write
gates). Next agent should upload the IPA, wait for processing in App Store
Connect, attach build **1.0.2 (5)** (or a newer rebuild) to the submission, and
submit for review.

If a new archive is needed with Distribution signing for Organizer:

- Ensure an **Apple Distribution** cert exists in the login keychain (this Mac
  had **0** Distribution/Development certs listed via `security find-identity`
  until Xcode automatic signing created a Development identity during the IPA
  build).
- Prefer re-running `flutter build ipa …` and uploading the IPA via Transporter
  rather than fighting Organizer.

## Remaining work checklist

- [ ] Upload `fabtrades.ipa` to App Store Connect (Transporter or `altool`)
- [ ] Wait for build processing; select it on the 1.0.2 version
- [ ] Confirm ASC still has: Privacy URL, Terms URL in App Description, demo
      account + Notes for Review ([APP_STORE_REVIEW.md](./APP_STORE_REVIEW.md))
- [ ] Submit for review
- [ ] Optionally commit the `DEVELOPMENT_TEAM` / `CODE_SIGN_STYLE` pbxproj
      changes if the team wants local Xcode signing baked in
- [ ] Android closed-track workflow may have been triggered by that tag — check
      https://github.com/Max-Escaler/fabtrades/actions if unintended
- [ ] Launch image warning from Flutter IPA validation: default placeholder
      launch image — not a blocker for this rejection, but worth cleaning later
- [ ] Verify demo email sign-in once on a device/TestFlight build against prod
      Supabase (Email provider enabled + user auto-confirmed)

## Key files touched

```
apps/web/src/content/termsOfUse.js                 (new)
apps/web/src/pages/TermsOfUse.jsx                  (new)
apps/web/src/content/privacyPolicy.js              (updated)
apps/web/src/App.jsx
apps/web/src/components/elements/Header.jsx
apps/web/scripts/generateSeoPages.js
apps/mobile/lib/core/config/legal_urls.dart        (new)
apps/mobile/lib/core/data/auth_repository.dart
apps/mobile/lib/core/models/account.dart
apps/mobile/lib/features/auth/sign_in_sheet.dart
apps/mobile/lib/features/auth/auth_provider_icons.dart
apps/mobile/lib/features/settings/settings_screen.dart
apps/mobile/lib/features/settings/subscription_section.dart
apps/mobile/pubspec.yaml                           (1.0.2+5)
apps/mobile/ios/Runner.xcodeproj/project.pbxproj   (local team; uncommitted)
docs/APP_STORE_REVIEW.md
docs/AUTH_PROVIDERS.md
docs/STORE_SETUP.md
docs/CHANGELOG.md
docs/PRODUCT.md
```

## Related docs

| Doc | Use |
| --- | --- |
| [APP_STORE_REVIEW.md](./APP_STORE_REVIEW.md) | ASC fields + Notes for Review paste text |
| [STORE_SETUP.md](./STORE_SETUP.md) | ASC / Play / RevenueCat product IDs |
| [AUTH_PROVIDERS.md](./AUTH_PROVIDERS.md) | OAuth + email provider setup |
| [RELEASING.md](./RELEASING.md) | Tag-based release (Android CI + local iOS build) |

## Do / don’t for the next agent

**Do**

- Upload the existing IPA (or rebuild locally with the same dart-defines)
- Keep legal URLs pointing at fabtrades.net
- Keep email sign-in for App Review demo accounts
- Prefer Transporter/`altool` over Organizer for Flutter archives

**Don’t**

- Point paywall Terms/Privacy back at revenuecat.com
- Commit demo account passwords
- Assume Organizer “Distribute App” works for CLI Flutter archives on this Mac
  without Distribution signing + Archives-folder placement
