# Contract: Printing recent-change overlay

Shared rules for attaching a recent Low change to **search-result Printings** on the movers landing. Production lookup is SQL (`fab_printing_recent_changes`); JS and Dart helpers must match this contract so `packages/contracts/printing_recent_changes.json` fails a build on drift.

This is **not** ranked movers. Ranking, $1 / €1 floor, top-10 cut, and sealed exclusion stay in [../../005-card-gainers-losers/contracts/recent-movers.md](../../005-card-gainers-losers/contracts/recent-movers.md) and `recent_movers.json`.

## Window and Lows

Same as 005:

- `today` = database `CURRENT_DATE` (UTC calendar date matching pipeline `captured_on`)
- Start window: `captured_on` ∈ `[today - 5, today - 3]` inclusive
- Start Low = most recent non-null marketplace Low in that band (`tcg_low` or `cm_low` for `p_source`)
- Latest Low = current `fab_card_prices` Low for the same source
- No interpolation. Null Low is missing, not zero. Never Market / Mid / High / Trend

Percent = `(latest_low - start_low) / start_low`. Amount = `latest_low - start_low`. SQL `numeric`.

## Displayable overlay (must all hold)

1. Printing id was requested
2. Start Low exists in the window
3. Latest Low exists
4. `latest_low ≠ start_low`
5. `start_low <= 10000` and `latest_low <= 10000`
6. `abs((latest_low - start_low) / start_low) <= 10`

If any fail: **no overlay row**. The search box still shows if the name matched.

## Explicitly not applied

| Ranked-movers rule | Search overlay |
| --- | --- |
| `start_low >= 1.00` | **Do not apply.** Under-floor still returns percent and amount |
| Top 10 per direction | **Do not apply.** One optional row per requested id |
| Exclude sealed | **Do not apply.** Search matching owns membership |
| Exclude 0% from the **list of cards** | 0% omits **overlay only**; the box remains |

## Fixture expectations

`packages/contracts/printing_recent_changes.json` (implement):

| Case | Expected overlay |
| --- | --- |
| TCG uses `tcg_low` only | Change from tcg columns |
| CardMarket uses `cm_low` only | Change from cm columns |
| Null Low | No overlay (never 0) |
| Start Low 0.30 → latest 0.60 | Overlay present (floor does not apply) |
| Start Low 2.00 → latest 2.00 | No overlay |
| No snapshot in 3–5 day window | No overlay |
| `abs(percent) > 10` or Low above 10000 | No overlay |
| Id not in the requested set | No overlay |

Helpers take `{ today, source, snapshotsByCard, currentLows, cardIds }` and return the overlay map/list. They MUST NOT rank or apply the floor.

## Client display

| Overlay | Box |
| --- | --- |
| Present, percent &gt; 0 | Current Low + green/up percent and amount |
| Present, percent &lt; 0 | Current Low + red/down percent and amount |
| Absent | Identity + current Low (or unpriced). **No** 0%, **no** dash, **no** “No recent move” copy |

Current Low on the box comes from the catalog Printing, not from inventing RPC latest when the overlay is absent.
