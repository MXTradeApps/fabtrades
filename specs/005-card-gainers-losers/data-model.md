# Data Model: Recent Card Gainers and Losers

No new catalog tables. This feature reads existing snapshots and Binder rows, then derives ranked mover lists. Ranking rules are shared; chrome differs by surface ([home-entry.md](./contracts/home-entry.md), [web-destinations.md](./contracts/web-destinations.md)).

## Existing storage

### Printing (`fab_cards` + current prices)

Already on device (mobile catalog cache) or in the web catalog snapshot. Movers are keyed by the same id Binder, trade, and card details use.

| Field | Source | Movers use |
| --- | --- | --- |
| `id` | `fab_cards.id` | Printing key (`<product_id>-<subtype>`). Mobile `CardModel.id`. Web `_uniqueId`. |
| `name` | `fab_cards.name` | Row identity |
| `set_name` | `fab_sets.name` via join | Row identity |
| `sub_type_name` | `fab_cards.sub_type_name` | Finish (Normal, Rainbow Foil, …) |
| `image_url` | `fab_cards.image_url` | Optional thumbnail; not required by FR-004 |
| `is_sealed` | `fab_cards.is_sealed` | Sealed products are excluded |
| current Low | `fab_card_prices.tcg_low` / `cm_low` | **Latest** Low for `p_source` |

Relationship: one Printing has many price snapshots; at most one current prices row.

### Price snapshot (`fab_price_history`)

One observed catalog capture for a Printing on a calendar day. Written by nightly ingest; clients only SELECT (directly today for charts; this feature reads them through the RPC).

| Field | Type | Movers use |
| --- | --- | --- |
| `card_id` | text → `fab_cards.id` | Join |
| `captured_on` | date | Start window (date-only `YYYY-MM-DD`) |
| `tcg_low` | numeric, nullable | Start Low when source is TCGplayer |
| `cm_low` | numeric, nullable | Start Low when source is CardMarket |
| `tcg_market`, `cm_trend` | numeric, nullable | **Ignored** |

Constraints (already in schema):

- Unique `(card_id, captured_on)`
- Null Low means unpriced that day, not zero
- Public read (`anon` + `authenticated`). No client writes

Index added with this feature: btree on `captured_on` so the 3–5 day window filter does not seq-scan the full history table.

### Owned Printing (Binder entry)

Existing Binder rows. Want List is not a Binder.

| Field | Rule for owned movers |
| --- | --- |
| `card_id` / Printing id | Candidate id when owned |
| `isWanted` | Must be false |
| `quantity` | Must be > 0 |
| `binderId` | Any live Binder (Trade Binder, Collection, user Binders). Not used to split rows |
| `condition` | Ignored for ranking (descriptive only) |
| `deletedAt` | Tombstones are not owned |

Validation: the same Printing in two Binders (or two conditions) still contributes **one** owned id. See [recent-movers.md](./contracts/recent-movers.md).

Signed-out mobile: on-device entries count. Signed-out web: no Binder store (004) → treat as empty Binders (hide owned section).

## Derived entities

Shared by SQL `fab_recent_movers`, JS `recentMovers`, and Dart `recent_movers`. Golden cases: [packages/contracts/recent_movers.json](../../packages/contracts/recent_movers.json) (added at implement). Schema: [contracts/recent-movers.md](./contracts/recent-movers.md).

### Start Low observation

| Field | Rule |
| --- | --- |
| `card_id` | Printing id |
| `start_on` | `captured_on` of the chosen snapshot |
| `start_low` | Non-null Low for the selected marketplace |

Window: `start_on` ∈ `[today - 5 days, today - 3 days]` inclusive, where `today` is database `CURRENT_DATE`. If several observations fall in the window, keep the one with the latest `start_on`. Do not invent a Low for a missing day. Observations newer than 3 days or older than 5 days are ineligible as starts.

### Latest Low

| Field | Rule |
| --- | --- |
| `latest_low` | Current `fab_card_prices` Low for the same marketplace; must be non-null |

A day (or current row) with Market/Trend filled and Low missing is still unpriced for movers.

### Recent Low change (derived)

| Field | Rule |
| --- | --- |
| `amount_change` | `latest_low - start_low` |
| `percent_change` | `(latest_low - start_low) / start_low` (SQL `numeric`; tests may expose × 100 as display percent) |
| `direction` | `gainer` if percent > 0; `loser` if percent < 0; else ineligible |

### Eligibility (must all hold)

1. Non-sealed Printing
2. Start Low observation exists in the 3–5 day window
3. Latest Low exists
4. `start_low >= 1.00` (USD for TCGplayer, EUR for CardMarket)
5. `start_low <= 10000` and `latest_low <= 10000` (omit garbage catalog Lows, not real six-figure singles)
6. `abs(percent_change) <= 10` (omit 1000%+ spikes in the 3–5 day window)
7. `percent_change ≠ 0` (equivalently `latest_low ≠ start_low`)

Ineligible Printings are omitted, never shown as `$0.00` / `€0.00`.

### Ranked list

| Field | Rule |
| --- | --- |
| Gainers | Eligible with percent > 0; sort percent DESC, then `card_id` ASC |
| Losers | Eligible with percent < 0; sort percent ASC (most negative first), then `card_id` ASC |
| Cut | `rank` 1…10 per direction; if fewer than 10 qualify, return all of them; never pad |

Catalog-wide: eligible set is the whole catalog (minus sealed). Owned: eligible set is the owned Printing id set, then the same rules and cut.

### Movers landing composition (view model, not stored)

| Binders | Body of the movers landing (empty search) |
| --- | --- |
| At least one owned Printing (qty > 0 in any Binder) | Owned gainers/losers first (lists or honest empty), then catalog-wide |
| Zero owned Printings | Catalog-wide only; owned section omitted |

Where that landing lives:

| Surface | Empty search | Search active |
| --- | --- | --- |
| Mobile Home | Movers as composed above, then the existing set list | Catalog Printing results; movers and set list covered |
| Web Trends (`/trends`) | Movers as composed above. **No set list.** | Catalog Printing results; movers covered. Clear → movers |
| Web Browse Sets (`/sets`) | Existing set list. **No movers.** | Catalog Printing results; set list covered. Clear → set list |

## State transitions

```text
Movers landing open (empty search)
    ├─ catalog-wide fetch
    │     ├─ loading ──► lists | empty copy | error+retry
    │     └─ marketplace change ──► drop stale ──► loading
    └─ owned ids from local Binders
          ├─ none ──► hide owned section
          ├─ some ──► fetch RPC(card_ids)
          │     ├─ loading ──► lists | empty copy | error+retry
          │     └─ still never blocks search / other destinations
          └─ Binders become empty ──► hide owned (do not leave a blank card)

Web Browse Sets open
    └─ no movers fetch
          ├─ empty search ──► set list
          └─ search ──► Printing results (same catalog matching as Trends)
```

Row select → existing card details for that Printing id → back returns to the movers landing (mobile Home tab stack / web overlay close on `/trends`). Details MUST keep today’s prices; movers do not replace the history chart.

Printing search result select → same existing details. Clear search returns to that destination’s empty-search body.

## Validation at the boundary

- `p_source` ∈ `{tcgplayer, cardmarket}` or the RPC errors (no default).
- `p_card_ids` null → catalog-wide. Empty array → no rows (caller should hide owned instead of calling).
- `captured_on` compared as dates, never as UTC-midnight timestamps in clients.
- Lows stay nullable numbers. Never default null to `0`.
- Web `openDetail` requires a catalog Printing with `_uniqueId`. Look the row up in the snapshot; do not synthesize a partial card from RPC identity fields alone.
