# Contract: Price history series (shared)

Golden fixture for the Low-series rules both clients implement. Schema and cases live in [`packages/contracts/price_history_series.json`](../../../packages/contracts/price_history_series.json).

This is **not** the HTTP read (see [price-history-read.md](./price-history-read.md)) and **not** overlay/page chrome (see [history-section.md](./history-section.md)).

## Implementations

| Client | Module | Test |
| --- | --- | --- |
| Web | `apps/web/src/utils/priceHistorySeries.js` | `apps/web/tests/contracts/priceHistorySeries.contract.test.js` |
| Mobile | `apps/mobile/lib/core/logic/price_history_series.dart` | `apps/mobile/test/contracts/price_history_series_contract_test.dart` |

Both suites MUST load the JSON and assert `expected` for every case. If one side fails, fix that implementation, not the fixture, unless the product rule itself changed.

## Clock

Top-level `now` is `YYYY-MM-DD`. `windowStart` is that date minus 29 calendar days (inclusive 30-day span). Cases use this clock unless they override `now`.

Compare dates as calendar days. Do not parse `captured_on` as UTC midnight.

## Case shape

| Field | Meaning |
| --- | --- |
| `name` | Stable test title |
| `source` | `tcgplayer` or `cardmarket` |
| `window` | `last30` or `full` |
| `snapshots` | Rows with `captured_on`, nullable `tcg_low` / `cm_low` / `tcg_market` / `cm_trend` |
| `expected.points` | Visible Low observations `{ date, low }`, oldest first |
| `expected.hasOlder` | Any usable Low before `windowStart` |
| `expected.chartable` | `points.length >= 2` |
| `expected.delta` | Last visible Low − first visible Low, or `null` if not chartable |

Omitted snapshot fields are treated as null. Null Low is dropped (gap), never `0`.

## Out of this fixture

- Pro CTA visibility (mobile-only)
- Inspect gestures
- Formatted change labels (`Low up $1.00`)
- Fetch / loading / error
