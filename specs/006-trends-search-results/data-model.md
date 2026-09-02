# Data Model: Trends Search Results as Mover Boxes

No new catalog tables. Search identity stays the existing Printing snapshot. Recent change for a match is a **derived overlay** from the same history + current Low rules as 005, with different **display eligibility** ([printing-recent-changes.md](./contracts/printing-recent-changes.md)).

Ranked movers composition is unchanged ([../../005-card-gainers-losers/data-model.md](../005-card-gainers-losers/data-model.md)). This feature only changes how **active search** on the movers landing presents matching Printings.

## Existing storage

### Printing (catalog snapshot)

Already on device (mobile `catalogProvider`) or in the web catalog snapshot. Search matching and box identity use this row. Current Low on the box is this row’s marketplace Low, shown as unpriced when null — never as zero.

| Field | Movers-landing search use |
| --- | --- |
| `id` / `_uniqueId` | Match key; lookup key for change overlay; details navigation |
| `name`, set, finish | Box identity (FR-002) |
| `image_url` | Same thumbnail treatment as ranked mover boxes |
| current Low | Box current Low (`tcg_low` / `cm_low` by selected source) |

Relationship: one Printing has at most one change overlay for the current marketplace and query.

### Price snapshot (`fab_price_history`) and current prices (`fab_card_prices`)

Same as 005. Start Low is the most recent observed marketplace Low with `captured_on` in `[CURRENT_DATE - 5, CURRENT_DATE - 3]`. Latest Low for **displayable change** is `fab_card_prices` for `p_source`. Clients do not compute the window locally.

No new indexes beyond 005’s `captured_on` btree. Filter by `p_card_ids` uses existing `fab_price_history_card_id_idx`.

## Derived entities

Shared by SQL `fab_printing_recent_changes`, JS, and Dart. Golden cases: [packages/contracts/printing_recent_changes.json](../../packages/contracts/printing_recent_changes.json) (added at implement). Schema: [printing-recent-changes.md](./contracts/printing-recent-changes.md).

### Search-result Printing (view)

| Field | Rule |
| --- | --- |
| Catalog Printing | Name match from existing catalog search; existing result cap |
| Order | Default: name-match quality. Mobile Home: existing catalog sort still applies. Web Trends: no new sort. Never percent-change sort |
| Box | Mover-box chrome (not a name-and-price list) |

A Printing that is not on the ranked top 10 still appears if it matches.

### Displayable recent Low change (overlay)

Same formulas as 005 **Recent Low change**:

| Field | Rule |
| --- | --- |
| `amount_change` | `latest_low - start_low` |
| `percent_change` | `(latest_low - start_low) / start_low` |
| `direction` | `gainer` if percent > 0; `loser` if percent < 0 |

### Display eligibility (RPC returns a row only if all hold)

1. `card_id` was requested in `p_card_ids`
2. Start Low observation exists in the 3–5 day window
3. Latest Low exists
4. `percent_change ≠ 0`
5. `start_low <= 10000` and `latest_low <= 10000`
6. `abs(percent_change) <= 10`

**Not applied** (unlike ranked movers):

- `start_low >= 1.00` floor — under-floor matches still get a change row
- Top-10 cut
- Sealed exclusion — membership is the search match set
- Dropping the Printing from search when ineligible — the box still shows; only the overlay is absent

Ineligible overlays are omitted, never sent as `$0.00` / `0%`.

### Movers landing body (search-aware)

| Surface | Empty search | Search active |
| --- | --- | --- |
| Mobile Home | Ranked movers + set list (005) | Trend boxes for matches; movers and set list covered |
| Web Trends | Ranked movers (005). No set list | Trend boxes for matches; movers covered |
| Web Browse Sets | Set list. No movers | **List** of matches (005). Not trend boxes |
| Mobile in-set | — | Existing set-scoped list |

## State transitions

```text
Movers landing, query empty
    └─ ranked movers (005) + (mobile) set list

Query non-empty (Trends / Home)
    ├─ match Printings in memory
    │     ├─ none ──► no-match copy (no empty boxes, no $0 rows)
    │     └─ some ──► trend boxes from catalog (identity + current Low)
    │           └─ debounce ──► lookup RPC(ids)
    │                 ├─ rows ──► merge percent/amount by card_id (color up/down)
    │                 ├─ no row for an id ──► omit that box’s change line
    │                 ├─ error ──► boxes stay; retry on figures only
    │                 └─ query / marketplace / unmount ──► ignore stale
    └─ clear query ──► ranked movers body (search boxes gone)

Web Browse Sets, query non-empty
    └─ CatalogPrintingResults list (no lookup RPC required by this feature)
```

Box select → existing card details for that catalog Printing → back restores the movers landing with the same query and boxes (FR-014).

## Validation at the boundary

- `p_source` ∈ `{tcgplayer, cardmarket}` or the RPC errors (no default).
- `p_card_ids` MUST be a non-null array. `NULL` → error (do not catalog-scan). Empty array → `[]`.
- Ids not in the catalog or without a displayable change are skipped, not an error.
- Pass at most the Printings currently in the search result list.
- Lows stay nullable numbers. Never default null to `0`.
- Web `openDetail` / mobile details require the catalog Printing. Do not synthesize a card from change-row fields alone.
