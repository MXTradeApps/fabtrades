# Quickstart: Card Price History

Validation guide after implementation. Details of series math and UI states: [data-model.md](./data-model.md), [contracts/history-section.md](./contracts/history-section.md), [contracts/price-history-read.md](./contracts/price-history-read.md).

## Prerequisites

- Flutter SDK matching `apps/mobile` (`sdk: ^3.12.2`)
- App built against a Supabase project that already has `fab_price_history` (staging or prod). No new migration to apply.
- A catalog that has been ingested at least twice on different days so some Printings have ≥ 2 `tcg_low` snapshots.
- Optional: a sandbox Apple/Google account that can purchase FABTrades Pro (existing RevenueCat staging setup).

```bash
cd apps/mobile
flutter pub get
```

## Automated checks

```bash
cd apps/mobile
flutter test test/core/logic/price_history_series_test.dart
flutter test test/widgets/price_history_section_test.dart
flutter test
```

Expected:
- Series tests cover Low extraction, null-as-gap (never 0), 30-day clip, delta over the **visible** window, `hasOlder`, and when CTA / span chrome is shown.
- Widget tests: section sits under a Prices heading; loading/empty/error leave Prices visible; free sees the Pro line only when older points exist; Pro sees span control instead.
- Full `flutter test` stays green (CI path).

## Manual — free / signed-out (P1 + P3)

1. Launch a non-Pro build, signed out.
2. Open a Printing with several days of TCG Low history (search → card details).
3. Confirm **Prices** is fully visible, then a history section **directly under it** with one Low line and a change summary.
4. Default span is ~30 days even if ingest is older.
5. Tap/hold a point: date + Low. No navigation. No `$0.00` on a gap.
6. If older snapshots exist: quiet “See full history with Pro” under the chart. Tap opens the existing upgrade flow; the 30-day chart remains.
7. Airplane mode, then open another Printing: page and Prices still render; history shows failure/retry, not a spinner forever.
8. Settings → CardMarket: history empty (no silent TCG line) while CardMarket ingest is disabled. Switch back to TCGplayer: TCG line returns.

## Manual — Versions (P2)

1. Open a card with at least two Printings that have different Low paths (e.g. Normal vs Cold Foil).
2. Switch Versions: history series and change summary follow the selection. No leftover points from the previous Printing once the new series has loaded.
3. Pick a Printing with < 2 Lows: empty copy, not a flat zero line.

## Manual — Pro (P1)

1. Restore or purchase Pro (sandbox). Stay on the same card details screen if coming from the CTA.
2. Chart still defaults to 30 days. No “See full history with Pro”.
3. Span control appears only when older snapshots exist. Switch to full span: older Lows and an updated change summary. Switch back to 30 days.
4. Signed-out again (or a free account): span control gone; 30-day window only.

## Pipeline sanity (unchanged; only if history looks empty for everyone)

```bash
cd services/price-pipeline
npm run dry-run   # no writes
```

Confirm ingest still documents `fab_price_history` in `services/price-pipeline/README.md`. Do not run `npm run ingest` against production from a laptop unless you are the operator on duty.

## Done when

- [ ] Automated tests above pass
- [ ] Free glance under Prices works without an account
- [ ] Pro full-span is opt-in, not the default
- [ ] Unpriced days never display as zero
- [ ] Web unchanged
