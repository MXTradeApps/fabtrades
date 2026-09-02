# Quickstart: Trends Search Results as Mover Boxes

Validation after implementation. Model: [data-model.md](./data-model.md). Overlay: [contracts/printing-recent-changes.md](./contracts/printing-recent-changes.md). Read: [contracts/printing-recent-changes-read.md](./contracts/printing-recent-changes-read.md). UI: [contracts/movers-landing-search.md](./contracts/movers-landing-search.md).

## Prerequisites

- Node matching `apps/web` (root README). Flutter SDK matching `apps/mobile`.
- 005 migration `fab_recent_movers` **and** this feature’s `fab_printing_recent_changes` applied to the Supabase project the apps already use.
- Catalog snapshot unchanged. History depth as in 005 (some Printings with a Low 3–5 days before `CURRENT_DATE`).

```bash
cd apps/web && npm install
cd ../mobile && flutter pub get
```

## Automated checks

```bash
cd apps/web
npm test -- tests/contracts/printingRecentChanges.contract.test.js
npm test -- tests/utils/recentMovers.test.js
npm test -- tests/services/fabDb.printingRecentChanges.test.js
npm test -- tests/pages/Trends.test.jsx
npm test -- tests/pages/SetList.test.jsx
npm test

cd ../mobile
flutter test test/contracts/printing_recent_changes_contract_test.dart
flutter test test/core/logic/recent_movers_test.dart
flutter test test/widgets/home_movers_test.dart
flutter test
```

Expected:

- Both contract suites pass the same `packages/contracts/printing_recent_changes.json` cases (under-floor overlay present; 0% / missing window / outliers absent; TCG vs CM columns; no null-as-zero).
- `recent_movers.json` ranking tests still pass (floor and top-10 unchanged).
- Web Trends tests: non-empty search renders trend boxes (not the Browse Sets list); clear search returns ranked movers; under-floor match can show percent; no-overlay omits the change line.
- Web Browse Sets tests: search still a catalog list; no trend-box grid.
- Mobile: Home global search uses trend boxes; in-set search remains a list; Home sort still applies.
- Full `npm test` and `flutter test` stay green (CI paths).

## Manual — Trends / Home search boxes (P1)

1. Web `/trends`, empty search: ranked movers as today. Type a card name that exists: ranked lists are replaced by **boxes** (thumbnail, name, set, finish, current Low), not a plain list.
2. A match that recently moved shows percent and currency, up vs down at a glance — including a card that would miss the ranked $1 / €1 floor.
3. A match with no 3–5 day start (or unpriced, or unchanged Low): box still there; **no** percent, **no** `$0.00`, **no** dash, **no** “No recent move” label.
4. Several finishes of the same name: one box each.
5. Select a box: existing card details for **that** Printing; back keeps the query and boxes.
6. Clear search: ranked movers return.
7. Mobile Home: same box presentation for global search. Existing sort still reorders boxes. Open a set and search there: still the old list.

## Manual — Browse Sets unchanged (P1)

1. Open **Browse Sets** (`/sets`). Type the same card name: results stay the catalog **list**. No Trends-style boxes.
2. Clear search: set list returns.

## Manual — honesty (P3)

1. Throttle the lookup (or break the new RPC): Trends/Home still shows matching boxes with identity and current Low; no invented percents; retry does not block Binder or trade. Browse Sets still searches.
2. Switch marketplace: overlay figures rebuild for that Low series; leftover TCG percents must not remain on CardMarket.
3. Signed-out: catalog search boxes work without an account.

## Pipeline sanity (unchanged)

```bash
cd services/price-pipeline
npm run dry-run   # no writes
```

Do not run `npm run ingest` against production from a laptop unless you are the operator on duty. Ingest does not write a changes table. The new RPC is documented in its migration.
