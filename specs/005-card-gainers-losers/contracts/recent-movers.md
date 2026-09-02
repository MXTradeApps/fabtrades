# Contract: Recent movers ranking

Shared rules for catalog-wide and owned lists. Production ranking is SQL (`fab_recent_movers`); JS and Dart helpers must match this contract so `packages/contracts/recent_movers.json` fails a build on drift.

Related: [recent-movers-read.md](./recent-movers-read.md) (RPC), [home-entry.md](./home-entry.md) (UI), [web-destinations.md](./web-destinations.md) (web chrome).

## Marketplace

| `source` | Start / latest Low column | Floor | Currency |
| --- | --- | --- | --- |
| `tcgplayer` | `tcg_low` | `start_low >= 1.00` | USD |
| `cardmarket` | `cm_low` | `start_low >= 1.00` | EUR |

Never Market, Mid, High, Trend, or the other marketplace’s Low. Never blend.

## Window

Let `today` be the catalog calendar date used by ingest (`CURRENT_DATE` in the RPC).

- Start candidates: observed Lows with `captured_on` ∈ `[today - 5, today - 3]` inclusive.
- Start Low: among those candidates for one Printing, the one with the greatest `captured_on`.
- Latest Low: current `fab_card_prices` Low for `source`.

Fixture cases use an explicit `today` string so tests do not depend on the machine clock.

## Percent and amount

```text
amount_change  = latest_low - start_low
percent_change = (latest_low - start_low) / start_low
```

Display may show `percent_change * 100` with a % sign. Ranking uses the ratio (or the equivalent × 100), not the currency amount.

## Eligibility

A Printing is **ineligible** (omit, do not zero) when any of:

- `is_sealed`
- no start observation in the window
- `latest_low` is null
- `start_low < 1`
- `start_low` or `latest_low` above `10000` (implausible catalog Low)
- `abs(percent_change) > 10` (more than 1000% in the 3–5 day window)
- `latest_low === start_low` (0% change)

Cheap spike example: start `0.30`, latest `0.60` → excluded by the floor even though percent is +100%.

## Rank

| List | Filter | Order |
| --- | --- | --- |
| Gainers | `percent_change > 0` | `percent_change` DESC, `card_id` ASC |
| Losers | `percent_change < 0` | `percent_change` ASC, `card_id` ASC |

Take at most **10** per list. Ties in percent must not reshuffle on refresh: `card_id` is the stable tail.

## Owned Printing ids

Input: Binder entries (and only Binder entries).

```text
ownedPrintingIds(entries) =
  unique card_id
  where not isWanted
    and quantity > 0
    and not tombstoned
```

- Want List → excluded
- Same Printing in Trade Binder and Collection → one id
- Same Printing, two conditions → one id
- Empty result → caller **hides** the owned section (does not request owned movers)

## Fixture schema

`packages/contracts/recent_movers.json`:

| Key | Meaning |
| --- | --- |
| `today` | `YYYY-MM-DD` for window math in ranking cases |
| `ranking_cases` | `{ name, source, snapshots_by_card, current_lows, expected: { gainers, losers } }` |
| `owned_id_cases` | `{ name, entries, expected_ids }` |

Each expected row includes `card_id`, `start_on`, `start_low`, `latest_low`, `percent_change`, `amount_change` so both languages assert observed vs derived fields separately.

Ranking cases MUST include: TCG vs CM column choice, null Low skipped, start 4 days ago used when 3 is missing, 2-day-old and 6-day-old starts rejected, floor, 0% dropped, sealed dropped, implausible Low/percent omitted, top-10 cut, percent tie broken by `card_id`, owned duplicate Binders collapsed.

## Surfaces

Both clients MUST use this ranking (via RPC + helpers that match the fixture). Chrome (Home vs Trends vs Browse Sets, colors, search) is [home-entry.md](./home-entry.md) and [web-destinations.md](./web-destinations.md).
