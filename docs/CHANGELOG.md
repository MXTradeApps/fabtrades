# Changelog

All notable changes to **FAB Trades** are documented here. Mobile app versions
are tracked in `apps/mobile/pubspec.yaml` (`version: name+build`).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **Find Trade Filler** is free on mobile. The Pro lock, badge, and paywall
  gate are gone; anyone can open the sheet from an unbalanced trade.

## [1.0.2] — App Store review compliance

### Added

- **Terms of Use** at `https://fabtrades.net/terms` (App Store EULA URL for
  auto-renewable subscriptions), with Settings + subscription legal links in
  the mobile app.
- **Email/password sign-in** on mobile for App Review demo accounts.
- App Store review checklist: [APP_STORE_REVIEW.md](./APP_STORE_REVIEW.md).

### Changed

- Privacy Policy updated for mobile auth, cloud sync, and RevenueCat
  subscriptions.

### Removed

- **Find Trade Filler** from the website (`FindFillerDialog`,
  `findFiller.js`). Mobile trade filler is unchanged.

_Mobile is still on **1.0.1+4** (no version bump for the 2026-07-17 polish
wave below)._

---

## [2026-07-17] — Browse polish, trade filler, dark mode, deploy

Shipped on `main` after the scanner wave. Web + mobile unless noted.

### Added

- **Find Trade Filler** (web + mobile). From an unbalanced trade, suggest
  catalog cards whose market price is closest to the value gap so the side
  that owes can even things out.
  - Web: `FindFillerDialog` + `src/utils/findFiller.js`
  - Mobile: `trade_filler_sheet.dart` + “Find Trade Filler” pill in the
    trade drag bar
- **Dark mode** (mobile). Settings appearance toggle (`AppThemeMode`);
  replaces the old market/low price-type switch.
- **Market + Low dual prices.** Market/trend is always the primary value
  (and the only value used for trade math). Low shows as a smaller
  secondary line when available (`Pricing.lowValue` / `lowPriceLabel`).
- **Set browse tiers** (web + mobile). Main expansions → Armory Decks →
  Silver Age → other product lines; newest-first within a tier
  (`setSort.js` / `set_sort.dart`).
- **Official set logos** on Browse.
  - Scraper: `scripts/scrapeSetLogos.cjs` → `public/setLogos.json` (+
    mobile asset copy)
  - Web set list paints logos (name fallback)
  - Mobile: year-long disk cache (`SetLogoCache`), warm/precache on
    Browse load, `SetLogoTitle` with soft plate for light/dark logos
- **Play Console closed-testing release workflow**
  (`.github/workflows/release-android-closed.yml`) — manual
  `workflow_dispatch` build + upload with track/status/version overrides.
- **Privacy policy** page on the web app (`/privacy`,
  `src/content/privacyPolicy.js`).

### Changed

- Browse set rows **drop per-set card counts** so logos can be taller
  (mobile logo height 28 → 40).
- Trade UI cleanup (web summary + mobile trade screen) after filler
  landed.
- CSV update workflow writes a more reliable `last-updated.txt`
  timestamp.

### Fixed

- **Pixel scanner lock reliability** (committed with filler; validated on
  Pixel 6a — see notes under 1.0.1+4 / learnings doc):
  - Confirm on **stripped card name**, not printing `id`
  - Tolerate 1–2 empty OCR frames while pending
  - Isolate ML Kit `PlatformException` from the visual path
  - Prefer longer distinctive name-token matches
- Set logos **flashing** when returning from Settings (gapless
  `Image` + aligned memory precache keys).
- Set logos **unloading** after opening a set and popping back
  (retain decoded frames; remount with `RawImage`).
- Daily CSV / price-guide refreshes (routine data updates).

### Docs

- `docs/mobile/card-scanning-learnings.md` — Pixel debug write-up
  (also the source RiftTrades ported from).

### Notes / follow-ups

- Mobile version string still **1.0.1+4** — bump before the next Play
  upload if closed testing already consumed that build number.
- Live phone pHash still rarely passes the 5σ gate; OCR + two-frame
  confirm remains the production scan path.
- Vault mirror: MyBrain `FABTrades Changelog` / `FABTrades Index`.

---

## [1.0.1+4] — 2026-07-16 — Mobile “better scan”

### Added

- Guide-region **card rectification** (`lib/core/scan/rectify.dart`) before
  pHash — recovers offset / scale / modest tilt; defers to the fixed guide
  crop when the card already fills the guide.
- Offline **accuracy harness** (`tool/evaluate_scan.dart`) comparing
  baseline vs rectified hashing under synthetic camera augmentations.
- Collector-number bonus in RRF fusion when OCR sees an `NNN/TTT`-style
  number (many FAB cards use set-code numbers instead — name OCR remains
  primary).
- Unit coverage for rectify + scan matching updates.

### Changed

- Frame hasher / pHash pipeline updated to feed rectified samples when
  useful.
- App version **1.0.1+4**.

### Notes

- Synthetic harness: rectification lifted overall top-1 ≈31%→47% and
  top-3 ≈47%→73%, with large gains on misaligned (`offset` / `rotate10`)
  cases.
- Live Pixel pHash still rarely passes the 5σ outlier gate; OCR + confirm
  is the production path until phone visual matching improves.

---

## [1.0.0] — Mobile app introduced

### Added

- Flutter mobile app (`mobile/`) alongside the existing web trade balancer.
- Live streaming scanner: camera + ML Kit OCR + bundled pHash visual index,
  fused per frame, with two-frame auto-lock.
- Core trade / catalog flows ported for on-device use (see mobile app + web
  README for product surface).
- Privacy policy surface on web (expanded 2026-07-15).
