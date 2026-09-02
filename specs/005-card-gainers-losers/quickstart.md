# Quickstart: Recent Card Gainers and Losers

Validation after implementation. Model: [data-model.md](./data-model.md). Ranking: [contracts/recent-movers.md](./contracts/recent-movers.md). Read: [contracts/recent-movers-read.md](./contracts/recent-movers-read.md). UI: [contracts/home-entry.md](./contracts/home-entry.md). Web split: [contracts/web-destinations.md](./contracts/web-destinations.md).

## Prerequisites

- Node matching `apps/web` (root README). Flutter SDK matching `apps/mobile`.
- Migration `fab_recent_movers` applied to the Supabase project the apps already use (staging or local). Catalog snapshot unchanged.
- History depth: ingest on enough distinct UTC dates that some Printings have a `tcg_low` on a day 3–5 days before `CURRENT_DATE` and a current `fab_card_prices.tcg_low`.
- Optional: a device/user with Binder Printings (mobile signed-out is enough; web needs sign-in for owned).

```bash
cd apps/web && npm install
cd ../mobile && flutter pub get
```

## Automated checks

```bash
cd apps/web
npm test -- tests/contracts/recentMovers.contract.test.js
npm test -- tests/utils/recentMovers.test.js
npm test -- tests/services/fabDb.recentMovers.test.js
npm test -- tests/pages/Trends.test.jsx
npm test -- tests/pages/SetList.test.jsx
npm test

cd ../mobile
flutter test test/contracts/recent_movers_contract_test.dart
flutter test test/core/logic/recent_movers_test.dart
flutter test test/widgets/app_smoke_test.dart
flutter test
```

Expected:

- Both contract suites pass the same `packages/contracts/recent_movers.json` cases (window, floor, 0%, ties, owned ids, TCG vs CM columns, no null-as-zero).
- Web Trends tests: hamburger **Trends**, no Home nav, movers with no set list, catalog Printing search covers movers, signed-out has no owned section. `/` is still the trade calculator.
- Web Browse Sets tests: set list on empty search, catalog Printing search covers the set list, no movers, clearing search returns the set list.
- Mobile smoke/integration: first tab is **Home**, not Browse; search still finds Printings without opening a set; empty search shows movers above the set list.
- Full `npm test` and `flutter test` stay green (CI paths).

## Manual — catalog-wide movers landing (P1)

1. Mobile signed-out, empty Binders: open the first tab. Label is Home. Landing is recent movers (catalog-wide), not a set grid as the first content. No owned block. Set list is below movers. Search all cards still works immediately.
2. Web signed-out: open **Trends** (`/trends`) from the hamburger. Same catalog-wide lists. No set list on this page. Hamburger has Trends and Browse Sets, not Home. `/` is still the trade calculator.
3. Confirm a gainer row shows name, set, finish, current Low, percent, and currency amount; losers are visually distinct. Caption credits observed catalog Lows.
4. Cheap cards under $1 / €1 start Low are absent even if percent would be huge.
5. Tap/click a row: existing card details for **that** Printing; today’s prices still visible; back returns to the movers landing (Home / Trends).
6. Type a card name on the movers landing: Printing results from the whole catalog, no set first. Clear search: movers return.

## Manual — web Browse Sets search (P1)

1. Open **Browse Sets** (`/sets`). Empty search shows the set list, not movers.
2. Type a card name: matching Printings from the whole catalog, without opening a set. Select a result: existing card details.
3. Clear search: set list returns. Trends is unchanged (still a separate destination).

## Manual — owned movers (P2)

1. Mobile: add a qualifying Printing to any Binder (including Collection). Home shows **owned first**, catalog-wide below, as separate sections. The owned lists only include owned Printings. A hot catalog-wide card you do not own is not on owned.
2. Same Printing in two Binders: one owned row.
3. Want List only: owned section stays hidden if Binders are empty of qty > 0.
4. Own cards that do not qualify: owned empty copy first; catalog-wide still below; no `$0.00` row.
5. Web signed-in with Binder cards: same composition on `/trends`. Web signed-out: owned hidden.

## Manual — honesty (P4)

1. Throttle/offline: movers landing search and (mobile) other tabs still work; movers show failure/retry, not a spinner forever and not a fake zero list. Web Browse Sets still opens and searches.
2. Switch marketplace if the UI allows: lists rebuild for that Low series; leftover TCG rows must not remain on CardMarket (empty CM is allowed).
3. Short lists: if fewer than 10 qualify, see only those rows.

## Pipeline sanity (unchanged)

Movers are empty for everyone only if history is too thin or the RPC is missing.

```bash
cd services/price-pipeline
npm run dry-run   # no writes
```

Do not run `npm run ingest` against production from a laptop unless you are the operator on duty. Confirm `fab_price_history` is still documented in `services/price-pipeline/README.md`. The new RPC is documented in the migration; ingest does not write a movers table.
