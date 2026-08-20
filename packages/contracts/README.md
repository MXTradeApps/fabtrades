# Contracts

Golden fixtures for the business rules that exist twice in this repo, once in
JavaScript for the web app and once in Dart for the mobile app.

## Why this exists

The web app is React and the mobile app is Flutter, so the two cannot literally
share code. A handful of rules therefore have two implementations that must agree:
if `setBrowseTier` buckets a set differently on web than on mobile, the same
release looks like two different products.

Those files used to carry `// Keep in sync with ...` comments pointing at each
other. A comment cannot fail a build. These fixtures can: both test suites read
the same JSON and assert the same expected values, so drift shows up as a red
test in whichever language changed.

## Adding a case

Add it to the JSON, then run both suites:

```bash
cd apps/web && npm test
cd apps/mobile && flutter test
```

A new case that only one side satisfies means the implementations have already
drifted. Fix the code, not the fixture. The fixture is only wrong if it disagrees
with what the product should do — in which case change it and update both.

## What is deliberately not covered

- **Cash on a trade.** Mobile treats cash as an input on each side of a trade
  (`Trade.haveCash`); web derives a cash suggestion from the difference instead
  (`formatCashAmount`). Different features, so `trade_math.json` covers only
  line-item totals and the difference, which both compute identically.
- **String collation.** Web sorts names with `localeCompare` and mobile with
  `compareTo`, which disagree on non-ASCII input. The set-sort fixtures assert the
  sign of a comparison using ASCII names only.
- **Scanning, binder reconciliation, and the trade filler.** Mobile-only, so
  there is no second implementation to keep honest.
- **Price-history Pro CTA.** Mobile shows “See full history with Pro”; web does
  not. `price_history_series.json` covers Low extraction, the 30-day clip,
  gaps, and delta — not that chrome.

## Files

| Fixture | Web implementation | Mobile implementation |
| --- | --- | --- |
| `set_sort.json` | `apps/web/src/utils/setSort.js` | `apps/mobile/lib/core/logic/set_sort.dart` |
| `set_abbreviation.json` | `apps/web/src/utils/setAbbreviation.js` | `apps/mobile/lib/core/logic/set_abbreviation.dart` |
| `trade_math.json` | `apps/web/src/utils/trade.js` | `apps/mobile/lib/core/models/trade.dart` |
| `free_limits.json` | `apps/web/src/utils/freeLimits.js` | `apps/mobile/lib/core/logic/free_limits.dart` |
| `brand_palette.json` | `apps/web/src/contexts/ThemeContext.jsx` / `index.css` | `apps/mobile/lib/app/theme.dart` |
| `price_history_series.json` | `apps/web/src/utils/priceHistorySeries.js` | `apps/mobile/lib/core/logic/price_history_series.dart` |
| `binder_value_snapshot.json` | `apps/web/src/utils/binderValueSnapshot.js` | `apps/mobile/lib/core/logic/binder_value_snapshot.dart` |

`free_limits.json` is the one fixture where drift would destroy data rather than
just look inconsistent. Both clients enforce the free trade window by tombstoning
the oldest rows, so if web kept twelve trades and mobile ten, mobile would delete
two trades every time it synced — indistinguishable, from the customer's side, from
the app losing their history. Binder and want-list cases use `refuse` (never trim
existing rows); web and mobile both enforce those via `canAddDistinctCard` /
`_canAddNewCard`. Loaned-card cases remain mobile-only.
