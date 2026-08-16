# Quickstart: Card Price History

Validation guide after implementation. Details: [data-model.md](./data-model.md), [contracts/history-section.md](./contracts/history-section.md), [contracts/price-history-read.md](./contracts/price-history-read.md), [contracts/price-history-series.md](./contracts/price-history-series.md).

Mobile chart under Prices is already shipped. This pass is the **web overlay port** plus the shared series fixture.

## Prerequisites

- Node matching `apps/web` (see root README). Flutter SDK matching `apps/mobile` for the contract suite.
- App built against a Supabase project that already has `fab_price_history` (staging or prod). No new migration.
- A catalog ingested on at least two different days so some Printings have ≥ 2 `tcg_low` snapshots.
- Optional: a signed-in web user whose `entitlements` row is Pro (purchased in the app).

```bash
cd apps/web && npm install
cd ../mobile && flutter pub get
```

## Automated checks

```bash
cd apps/web
npm test -- tests/contracts/priceHistorySeries.contract.test.js
npm test -- tests/utils/priceHistorySeries.test.js
npm test -- tests/components/PriceHistorySection.test.jsx
npm test -- tests/components/CardDetailModal.test.jsx
npm test

cd ../mobile
flutter test test/contracts/price_history_series_contract_test.dart
flutter test
```

Expected:
- Both contract suites pass the same `packages/contracts/price_history_series.json` cases (Low extraction, null-as-gap, 30-day clip, visible-window delta, `hasOlder`, chartable).
- Web widget tests: section sits under a Prices heading in the overlay; loading/empty/error leave Prices visible; free/signed-out never see “See full history with Pro”; Pro sees span control only when older points exist; hover/tap shows date + Low, never `$0.00`.
- Full `npm test` and `flutter test` stay green (CI paths).

## Manual — web, free / signed-out (P1 + P3)

1. Open fabtrades (signed out) on desktop.
2. From search, a trade pile, or set browse, open a Printing with several days of TCG Low history.
3. Confirm **Prices** is fully visible in the overlay, then a history section **directly under it** with one Low line and a change summary.
4. Default span is ~30 days even if ingest is older. No “See full history with Pro” (or any subscribe prompt) under the chart.
5. Hover a point: date + Low. On a phone-width viewport, tap a point: same readout. Overlay stays open. No `$0.00` on a gap.
6. Throttle or offline, then open another Printing: overlay and Prices still render; history shows failure/retry, not a spinner forever.
7. If you can set marketplace to CardMarket: history empty (no silent TCG line). Back to TCGplayer: TCG line returns.

## Manual — web Versions (P2)

1. Open a card with at least two Printings that have different Low paths (e.g. Normal vs Rainbow Foil).
2. Switch Versions: history series and change summary follow the selection. No leftover points from the previous Printing once the new series has loaded.
3. Pick a Printing with < 2 Lows: empty copy, not a flat zero line.

## Manual — web Pro (P1)

1. Sign in as a user who is Pro (entitlement from the app). Stay on the overlay if already open.
2. Chart still defaults to 30 days. Still no upgrade copy.
3. Span control appears only when older snapshots exist. Switch to full span: older Lows and an updated change summary. Switch back to 30 days.
4. Close and reopen the overlay: back to 30-day default.
5. Sign out: span control gone; 30-day window only; still no CTA.

## Manual — mobile (regression)

Only if you touch `price_history_series.dart` while wiring the fixture. Free CTA, tap/hold inspect, and paywall trigger must still match [history-section.md](./contracts/history-section.md).

```bash
cd apps/mobile
flutter test test/core/logic/price_history_series_test.dart
flutter test test/widgets/price_history_section_test.dart
```

## Pipeline sanity (unchanged; only if history looks empty for everyone)

```bash
cd services/price-pipeline
npm run dry-run   # no writes
```

Confirm ingest still documents `fab_price_history` in `services/price-pipeline/README.md`. Do not run `npm run ingest` against production from a laptop unless you are the operator on duty.

## Done when

- [ ] Shared series contract passes on web and mobile
- [ ] Web overlay shows history under Prices without an account
- [ ] Web free players have no upgrade CTA in this section
- [ ] Pro full-span is opt-in, not the default, and resets when the overlay closes
- [ ] Unpriced days never display as zero
- [ ] Set browse and a new card route are unchanged (no inline sparklines)
